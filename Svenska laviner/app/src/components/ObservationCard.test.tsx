import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ObservationCard from "./ObservationCard";
import type { Observation, User } from "../types/observation";

const { auth } = vi.hoisted(() => ({ auth: { user: null as User | null, token: null as string | null } }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => auth }));

const obs: Observation = {
  id: 7,
  userId: 1,
  author: "Fjällräv",
  type: "sprickor",
  lat: 63.43,
  lon: 12.33,
  regionId: "sodra-jamtlandsfjallen",
  observedAt: "2027-01-22T10:00:00Z",
  createdAt: "2027-01-22T10:05:00Z",
  description: "Skjutsprickor på NO-sluttning vid 1100 m.",
  imagePath: null,
  hidden: false,
  reportCount: 0,
};

function as(user: User | null) {
  auth.user = user;
  auth.token = user ? "t" : null;
  render(<ObservationCard observation={obs} />);
}

const base = { emailVerified: true, canPost: true };
const owner: User = { ...base, id: 1, email: "a@b.se", displayName: "Fjällräv", isAdmin: false };
const other: User = { ...base, id: 2, email: "c@d.se", displayName: "Annan", isAdmin: false };
const admin: User = { ...base, id: 3, email: "e@f.se", displayName: "Admin", isAdmin: true };

describe("ObservationCard", () => {
  it("lists the warning signs and snow depth, skipping unknown signs", () => {
    auth.user = null;
    auth.token = null;
    render(
      <ObservationCard
        observation={{
          ...obs,
          dangerSigns: ["skjutsprickor", "wumpf", "okand" as never],
          snowDepthCm: 85,
        }}
      />
    );
    const details = screen.getByRole("list", { name: "Varningstecken och snödjup" });
    expect(details).toHaveTextContent("Skjutsprickor");
    expect(details).toHaveTextContent("Wumpf / kollaps");
    expect(details).toHaveTextContent("Snödjup 85 cm");
    expect(details.querySelectorAll("li")).toHaveLength(3);
  });

  it("shows no details list for older observations without them", () => {
    as(null);
    expect(screen.queryByRole("list", { name: "Varningstecken och snödjup" })).not.toBeInTheDocument();
  });

  it("shows the type label, author, region, and text", () => {
    as(null);
    expect(screen.getByText("Sprickor / bristningar")).toBeInTheDocument();
    expect(screen.getByText("Fjällräv")).toBeInTheDocument();
    expect(screen.getByText(/Södra Jämtlandsfjällen/)).toBeInTheDocument();
    expect(screen.getByText(/Skjutsprickor/)).toBeInTheDocument();
  });

  it("offers no actions to logged-out visitors", () => {
    as(null);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lets the owner delete but not report", () => {
    as(owner);
    expect(screen.getByRole("button", { name: "Ta bort" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anmäl" })).not.toBeInTheDocument();
  });

  it("lets other users report but not delete", () => {
    as(other);
    expect(screen.getByRole("button", { name: "Anmäl" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ta bort" })).not.toBeInTheDocument();
  });

  it("hides the report button until the user may post (email unverified)", () => {
    as({ ...other, emailVerified: false, canPost: false });
    expect(screen.queryByRole("button", { name: "Anmäl" })).not.toBeInTheDocument();
  });

  it("lets admins delete anyone's observation", () => {
    as(admin);
    expect(screen.getByRole("button", { name: "Ta bort" })).toBeInTheDocument();
  });
});
