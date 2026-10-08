import { currentUser, requirePoster, requireUser, type CommunityEnv, type User } from "./auth";
import { HttpError, nowIso, readJson } from "./http";
import { d1Store, enforce, record } from "./rateLimit";
import { SELECT_OBSERVATIONS, toObservation, type Observation, type ObservationRow } from "./observations";
import { toRoute, type PlannedRoute, type RouteRow } from "./routes";
import { canSeeTour, SELECT_TOURS, toTour, type Tour, type TourRow } from "./tours";
import type { ItemType } from "./socialCleanup";
import { badgesOf, experienceOf, type Badge } from "./profile";
import { notify, type Defer, type NotifyEnv } from "./notifications";

// Strava-style social layer: follow people (one-way, no approval needed),
// a feed of what the people you follow share, and comments and likes on
// tours, observations and shared routes. Nothing here widens who can see
// an item: comments and likes need the same access as the item itself.

const MAX_COMMENT = 2000;
const FEED_PAGE = 20;
const COMMENT_LIMIT = { max: 30, windowMs: 10 * 60 * 1000 };
const FOLLOW_LIMIT = { max: 100, windowMs: 60 * 60 * 1000 };
const ITEM_TYPES: ItemType[] = ["tour", "observation", "route"];

export function itemType(value: unknown): ItemType {
  if (typeof value === "string" && (ITEM_TYPES as string[]).includes(value)) return value as ItemType;
  throw new HttpError(400, "Okänd typ av inlägg.");
}

/** The item's owner, if the viewer may see it; otherwise a 404 that doesn't reveal it exists. */
export async function itemOwner(env: CommunityEnv, type: ItemType, id: number, viewer: User | null): Promise<number> {
  const notFound = new HttpError(404, "Inlägget finns inte.");
  if (type === "tour") {
    const row = await env.DB.prepare("SELECT user_id, shared, followers_only FROM tours WHERE id = ?")
      .bind(id)
      .first<Pick<TourRow, "user_id" | "shared" | "followers_only">>();
    if (!row || !(await canSeeTour(env, row, viewer?.id ?? null))) throw notFound;
    return row.user_id;
  }
  if (type === "observation") {
    const row = await env.DB.prepare("SELECT user_id, hidden FROM observations WHERE id = ?")
      .bind(id)
      .first<{ user_id: number; hidden: number }>();
    if (!row || (row.hidden === 1 && row.user_id !== viewer?.id && !viewer?.isAdmin)) throw notFound;
    return row.user_id;
  }
  const row = await env.DB.prepare("SELECT user_id, shared FROM routes WHERE id = ?")
    .bind(id)
    .first<{ user_id: number; shared: number }>();
  if (!row || (row.shared !== 1 && row.user_id !== viewer?.id)) throw notFound;
  return row.user_id;
}

// ---------- People ----------

export interface PersonSummary extends Badge {
  id: number;
  displayName: string;
  iFollow: boolean;
}

async function withBadges(env: CommunityEnv, people: Array<Omit<PersonSummary, keyof Badge>>): Promise<PersonSummary[]> {
  const badges = await badgesOf(env, people.map((p) => p.id));
  return people.map((p) => ({ ...p, ...(badges[p.id] ?? { avatarPath: null, xp: 0, isAdmin: false }) }));
}

export async function getPerson(request: Request, env: CommunityEnv, id: number) {
  const viewer = await currentUser(request, env);
  const row = await env.DB.prepare(
    `SELECT u.id, u.display_name,
            (SELECT COUNT(*) FROM follows WHERE followee_id = u.id) AS followers,
            (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) AS following,
            EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = u.id) AS i_follow,
            EXISTS (SELECT 1 FROM follows WHERE follower_id = u.id AND followee_id = ?) AS follows_me
       FROM users u WHERE u.id = ?`
  )
    .bind(viewer?.id ?? -1, viewer?.id ?? -1, id)
    .first<{ id: number; display_name: string; followers: number; following: number; i_follow: number; follows_me: number }>();
  if (!row) throw new HttpError(404, "Personen finns inte.");
  const exp = (await experienceOf(env, [row.id])).get(row.id)!;
  return {
    person: {
      ...exp,
      id: row.id,
      displayName: row.display_name,
      followers: row.followers,
      following: row.following,
      iFollow: row.i_follow === 1,
      followsMe: row.follows_me === 1,
      isMe: viewer?.id === row.id,
    },
  };
}

const UPPER_TO_LOWER: Array<[string, string]> = [
  ["Å", "å"], ["Ä", "ä"], ["Ö", "ö"], ["É", "é"], ["È", "è"], ["Ü", "ü"], ["Æ", "æ"], ["Ø", "ø"],
];

/** SQL lower-casing a column, including the Nordic letters SQLite's lower() leaves alone. */
function foldSql(column: string): string {
  return UPPER_TO_LOWER.reduce((sql, [upper, lower]) => `replace(${sql}, '${upper}', '${lower}')`, `lower(${column})`);
}

/** Find people by name (signed-in users only, to make scraping the user list harder). */
export async function searchPeople(request: Request, env: CommunityEnv) {
  const viewer = await requireUser(request, env);
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return { people: [] };
  // SQLite's LIKE and lower() only fold A–Z, so fold Å Ä Ö (and friends) by hand.
  const folded = q.toLocaleLowerCase("sv-SE");
  const pattern = `%${folded.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await env.DB.prepare(
    `SELECT u.id, u.display_name,
            EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = u.id) AS i_follow
       FROM users u WHERE ${foldSql("u.display_name")} LIKE ? ESCAPE '\\' AND u.id != ?
      ORDER BY u.display_name LIMIT 20`
  )
    .bind(viewer.id, pattern, viewer.id)
    .all<{ id: number; display_name: string; i_follow: number }>();
  return { people: await withBadges(env, rows.results.map((r) => ({ id: r.id, displayName: r.display_name, iFollow: r.i_follow === 1 }))) };
}

/** Who I follow and who follows me. Only ever for yourself. */
export async function myFollows(request: Request, env: CommunityEnv) {
  const me = await requireUser(request, env);
  const following = await env.DB.prepare(
    `SELECT u.id, u.display_name FROM follows f JOIN users u ON u.id = f.followee_id
      WHERE f.follower_id = ? ORDER BY u.display_name`
  )
    .bind(me.id)
    .all<{ id: number; display_name: string }>();
  const followers = await env.DB.prepare(
    `SELECT u.id, u.display_name,
            EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = u.id) AS i_follow
       FROM follows f JOIN users u ON u.id = f.follower_id
      WHERE f.followee_id = ? ORDER BY u.display_name`
  )
    .bind(me.id, me.id)
    .all<{ id: number; display_name: string; i_follow: number }>();
  return {
    following: await withBadges(env, following.results.map((r) => ({ id: r.id, displayName: r.display_name, iFollow: true }))),
    followers: await withBadges(
      env,
      followers.results.map((r) => ({ id: r.id, displayName: r.display_name, iFollow: r.i_follow === 1 }))
    ),
  };
}

export async function follow(request: Request, env: NotifyEnv, id: number, defer?: Defer) {
  const me = await requireUser(request, env);
  if (me.id === id) throw new HttpError(400, "Du kan inte följa dig själv.");
  const exists = await env.DB.prepare("SELECT 1 AS x FROM users WHERE id = ?").bind(id).first();
  if (!exists) throw new HttpError(404, "Personen finns inte.");
  const store = d1Store(env.DB);
  const key = `follow:${me.id}`;
  await enforce(store, [{ key, ...FOLLOW_LIMIT }], "Du har följt väldigt många den senaste timmen. Försök igen senare.");
  const added = await env.DB.prepare("INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)")
    .bind(me.id, id, nowIso())
    .run();
  await record(store, [key]);
  if (added.meta.changes) await notify(env, [{ userId: id, kind: "follow", actorId: me.id }], defer);
  return getPerson(request, env, id);
}

export async function unfollow(request: Request, env: CommunityEnv, id: number) {
  const me = await requireUser(request, env);
  await env.DB.prepare("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?").bind(me.id, id).run();
  return getPerson(request, env, id);
}

// ---------- Feed ----------

interface Reactions {
  likes: number;
  likedByMe: boolean;
  comments: number;
}

export type FeedItem =
  | ({ type: "tour"; id: number; createdAt: string; tour: Tour; line: Array<[number, number]> | null } & Reactions)
  | ({ type: "observation"; id: number; createdAt: string; observation: Observation } & Reactions)
  | ({ type: "route"; id: number; createdAt: string; route: PlannedRoute; author: { id: number; displayName: string } } & Reactions);

/** Likes and comment counts for a set of items, keyed "type:id". */
async function reactions(env: CommunityEnv, items: Array<{ type: ItemType; id: number }>, viewerId: number) {
  const out = new Map<string, Reactions>();
  for (const i of items) out.set(`${i.type}:${i.id}`, { likes: 0, likedByMe: false, comments: 0 });
  if (items.length === 0) return out;
  const clauses: string[] = [];
  const binds: unknown[] = [];
  for (const type of ITEM_TYPES) {
    const ids = items.filter((i) => i.type === type).map((i) => i.id);
    if (ids.length === 0) continue;
    clauses.push(`(item_type = ? AND item_id IN (${ids.map(() => "?").join(", ")}))`);
    binds.push(type, ...ids);
  }
  const where = clauses.join(" OR ");
  const likes = await env.DB.prepare(
    `SELECT item_type, item_id, COUNT(*) AS n, MAX(user_id = ?) AS mine FROM likes WHERE ${where} GROUP BY item_type, item_id`
  )
    .bind(viewerId, ...binds)
    .all<{ item_type: ItemType; item_id: number; n: number; mine: number }>();
  for (const r of likes.results) Object.assign(out.get(`${r.item_type}:${r.item_id}`)!, { likes: r.n, likedByMe: r.mine === 1 });
  const comments = await env.DB.prepare(
    `SELECT item_type, item_id, COUNT(*) AS n FROM comments WHERE hidden = 0 AND (${where}) GROUP BY item_type, item_id`
  )
    .bind(...binds)
    .all<{ item_type: ItemType; item_id: number; n: number }>();
  for (const r of comments.results) out.get(`${r.item_type}:${r.item_id}`)!.comments = r.n;
  return out;
}

/**
 * What the people you follow (and you) have shared, newest first: tours
 * you may see, observations that aren't hidden, and routes shared by link.
 * Pages by `before` (an ISO time from the previous page).
 */
export async function feed(request: Request, env: CommunityEnv) {
  const me = await requireUser(request, env);
  const url = new URL(request.url);
  const before = url.searchParams.get("before") ?? "9999";
  const people = `(SELECT followee_id FROM follows WHERE follower_id = ?) OR %s.user_id = ?`;
  const who = (alias: string) => `(${alias}.user_id IN ${people.replace("%s", alias)})`;

  const tours = await env.DB.prepare(
    `${SELECT_TOURS} WHERE ${who("t")} AND t.shared = 1 AND t.created_at < ? ORDER BY t.created_at DESC LIMIT ?`
  )
    .bind(me.id, me.id, before, FEED_PAGE)
    .all<TourRow & { preview: string | null }>();
  const observations = await env.DB.prepare(
    `${SELECT_OBSERVATIONS} WHERE ${who("o")} AND o.hidden = 0 AND o.created_at < ? ORDER BY o.created_at DESC LIMIT ?`
  )
    .bind(me.id, me.id, before, FEED_PAGE)
    .all<ObservationRow>();
  const routes = await env.DB.prepare(
    `SELECT r.*, u.display_name FROM routes r JOIN users u ON u.id = r.user_id
      WHERE ${who("r")} AND r.shared = 1 AND r.created_at < ? ORDER BY r.created_at DESC LIMIT ?`
  )
    .bind(me.id, me.id, before, FEED_PAGE)
    .all<RouteRow & { display_name: string }>();

  type Draft = { type: ItemType; id: number; createdAt: string; build: (r: Reactions) => FeedItem };
  const drafts: Draft[] = [
    ...tours.results.map((row): Draft => ({
      type: "tour",
      id: row.id,
      createdAt: row.created_at,
      build: (r) => ({
        type: "tour",
        id: row.id,
        createdAt: row.created_at,
        tour: toTour(row),
        line: row.preview ? (JSON.parse(row.preview) as Array<[number, number]>) : null,
        ...r,
      }),
    })),
    ...observations.results.map((row): Draft => ({
      type: "observation",
      id: row.id,
      createdAt: row.created_at,
      build: (r) => ({ type: "observation", id: row.id, createdAt: row.created_at, observation: toObservation(row), ...r }),
    })),
    ...routes.results.map((row): Draft => ({
      type: "route",
      id: row.id,
      createdAt: row.created_at,
      build: (r) => ({
        type: "route",
        id: row.id,
        createdAt: row.created_at,
        route: toRoute(row, me.id),
        author: { id: row.user_id, displayName: row.display_name },
        ...r,
      }),
    })),
  ];
  const page = drafts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, FEED_PAGE);
  const counts = await reactions(env, page, me.id);
  const items = page.map((d) => d.build(counts.get(`${d.type}:${d.id}`)!));
  const authors = items.map((i) => (i.type === "tour" ? i.tour.userId : i.type === "observation" ? i.observation.userId : i.author.id));
  return {
    items,
    /** Picture and experience of everyone in `items`, by user id. */
    people: await badgesOf(env, authors),
    nextBefore: page.length === FEED_PAGE ? page[page.length - 1].createdAt : null,
  };
}

// ---------- Comments and likes ----------

export interface Comment {
  id: number;
  userId: number;
  author: string;
  body: string;
  createdAt: string;
  /** The author, the item's owner and admins may delete. */
  canDelete: boolean;
}

export async function listComments(request: Request, env: CommunityEnv) {
  const url = new URL(request.url);
  const type = itemType(url.searchParams.get("type"));
  const id = Number(url.searchParams.get("id"));
  const viewer = await currentUser(request, env);
  const owner = await itemOwner(env, type, id, viewer);
  const rows = await env.DB.prepare(
    `SELECT c.id, c.user_id, c.body, c.created_at, u.display_name FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.item_type = ? AND c.item_id = ? AND (c.hidden = 0 OR c.user_id = ? OR ? = 1)
      ORDER BY c.created_at LIMIT 500`
  )
    .bind(type, id, viewer?.id ?? -1, viewer?.isAdmin ? 1 : 0)
    .all<{ id: number; user_id: number; body: string; created_at: string; display_name: string }>();
  const counts = viewer ? (await reactions(env, [{ type, id }], viewer.id)).get(`${type}:${id}`)! : null;
  const likes = counts?.likes ?? ((await env.DB.prepare("SELECT COUNT(*) AS n FROM likes WHERE item_type = ? AND item_id = ?").bind(type, id).first<{ n: number }>())?.n ?? 0);
  return {
    people: await badgesOf(env, rows.results.map((r) => r.user_id)),
    comments: rows.results.map(
      (r): Comment => ({
        id: r.id,
        userId: r.user_id,
        author: r.display_name,
        body: r.body,
        createdAt: r.created_at,
        canDelete: !!viewer && (viewer.id === r.user_id || viewer.id === owner || viewer.isAdmin),
      })
    ),
    likes,
    likedByMe: counts?.likedByMe ?? false,
  };
}

export async function addComment(request: Request, env: NotifyEnv, defer?: Defer) {
  const me = await requirePoster(request, env);
  const body = await readJson<{ type?: unknown; id?: unknown; body?: unknown }>(request);
  const type = itemType(body.type);
  const id = Number(body.id);
  const owner = await itemOwner(env, type, id, me);
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) throw new HttpError(400, "Skriv något först.");
  if (text.length > MAX_COMMENT) throw new HttpError(400, `En kommentar får vara högst ${MAX_COMMENT} tecken.`);
  const store = d1Store(env.DB);
  const key = `comment:${me.id}`;
  await enforce(store, [{ key, ...COMMENT_LIMIT }], "Du har skrivit många kommentarer på kort tid. Vänta en stund.");
  await env.DB.prepare("INSERT INTO comments (item_type, item_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(type, id, me.id, text, nowIso())
    .run();
  await record(store, [key]);
  // The owner, and everyone else who has commented here before.
  const others = await env.DB.prepare(
    "SELECT DISTINCT user_id FROM comments WHERE item_type = ? AND item_id = ? AND user_id NOT IN (?, ?) LIMIT 20"
  )
    .bind(type, id, me.id, owner)
    .all<{ user_id: number }>();
  await notify(
    env,
    [
      { userId: owner, kind: "comment", actorId: me.id, itemType: type, itemId: id },
      ...others.results.map((o) => ({ userId: o.user_id, kind: "reply" as const, actorId: me.id, itemType: type, itemId: id })),
    ],
    defer
  );
  return listComments(new Request(`https://x/comments?type=${type}&id=${id}`, { headers: request.headers }), env);
}

export async function deleteComment(request: Request, env: CommunityEnv, commentId: number) {
  const me = await requireUser(request, env);
  const row = await env.DB.prepare("SELECT user_id, item_type, item_id FROM comments WHERE id = ?")
    .bind(commentId)
    .first<{ user_id: number; item_type: ItemType; item_id: number }>();
  if (!row) throw new HttpError(404, "Kommentaren finns inte.");
  let allowed = me.isAdmin || me.id === row.user_id;
  if (!allowed) {
    try {
      allowed = (await itemOwner(env, row.item_type, row.item_id, me)) === me.id;
    } catch {
      allowed = false;
    }
  }
  if (!allowed) throw new HttpError(403, "Du kan inte ta bort den här kommentaren.");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM comments WHERE id = ?").bind(commentId),
    env.DB.prepare("DELETE FROM content_reports WHERE item_type = 'comment' AND item_id = ?").bind(commentId),
  ]);
  return { ok: true };
}

export async function setLike(request: Request, env: NotifyEnv, defer?: Defer) {
  const me = await requireUser(request, env);
  const body = await readJson<{ type?: unknown; id?: unknown; liked?: unknown }>(request);
  const type = itemType(body.type);
  const id = Number(body.id);
  const owner = await itemOwner(env, type, id, me);
  if (body.liked === false) {
    await env.DB.prepare("DELETE FROM likes WHERE item_type = ? AND item_id = ? AND user_id = ?").bind(type, id, me.id).run();
  } else {
    const added = await env.DB.prepare("INSERT OR IGNORE INTO likes (item_type, item_id, user_id, created_at) VALUES (?, ?, ?, ?)")
      .bind(type, id, me.id, nowIso())
      .run();
    if (added.meta.changes) await notify(env, [{ userId: owner, kind: "like", actorId: me.id, itemType: type, itemId: id }], defer);
  }
  const r = (await reactions(env, [{ type, id }], me.id)).get(`${type}:${id}`)!;
  return { likes: r.likes, likedByMe: r.likedByMe };
}
