import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queue = vi.hoisted(() => ({ list: [] as Array<{ failed?: string }> }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: { id: 1 } }) }));
vi.mock("../services/observationQueue", () => ({
  QUEUE_CHANGED_EVENT: "queue-changed",
  queuedObservations: async () => queue.list,
}));

import ObservationQueueBanner from "./ObservationQueueBanner";

describe("ObservationQueueBanner", () => {
  beforeEach(() => {
    queue.list = [];
  });

  it("says what waits for coverage, then that it was sent", async () => {
    queue.list = [{}, { failed: "För gammal" }];
    render(<MemoryRouter><ObservationQueueBanner /></MemoryRouter>);
    expect(await screen.findByText("1 observation väntar på täckning och skickas automatiskt.")).toBeInTheDocument();
    expect(screen.getByText("1 observation kunde inte skickas.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Visa" })).toHaveAttribute("href", "/observationer#vantar");

    queue.list = [];
    await act(async () => {
      window.dispatchEvent(new CustomEvent("queue-changed", { detail: { sent: 1 } }));
    });
    expect(await screen.findByText("Din observation är skickad.")).toBeInTheDocument();
  });

  it("is hidden when nothing waits", async () => {
    const { container } = render(<MemoryRouter><ObservationQueueBanner /></MemoryRouter>);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });
});
