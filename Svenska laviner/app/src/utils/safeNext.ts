/** Only same-app paths, so ?next= can't send someone to another site. */
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/profil";
}
