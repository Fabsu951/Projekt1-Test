import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FavoritesProvider from "../favorites/FavoritesProvider";
import WelcomeGuide from "./WelcomeGuide";

const { push } = vi.hoisted(() => ({
  push: {
    pushSupported: vi.fn(() => true),
    fetchPushKey: vi.fn(async (): Promise<string | null> => "PUBLIC"),
    regionPushEnabled: vi.fn(async (): Promise<boolean> => false),
    enablePush: vi.fn(async () => {}),
    updatePushRegions: vi.fn(async () => {}),
    disablePush: vi.fn(async () => {}),
  },
}));
vi.mock("../services/push", () => push);
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: null, token: null }) }));

function renderGuide(onClose = vi.fn()) {
  render(
    <FavoritesProvider>
      <WelcomeGuide onClose={onClose} />
    </FavoritesProvider>
  );
  return onClose;
}

async function toNotificationStep() {
  fireEvent.click(screen.getByRole("button", { name: /Kom igång/ }));
  fireEvent.click(screen.getByRole("button", { name: /Kebnekaisefjällen/ }));
  fireEvent.click(screen.getByRole("button", { name: /Nästa/ }));
  await act(async () => {});
}

describe("WelcomeGuide notifications", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(push).forEach((fn) => fn.mockClear());
  });

  it("has notifications ticked from the start and turns them on with Klar", async () => {
    const onClose = renderGuide();
    await toNotificationStep();
    const box = await screen.findByRole("checkbox", { name: "Notis när farograden ändras i mina områden" });
    expect(box).toBeChecked();
    expect(push.enablePush).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Klar/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(push.enablePush).toHaveBeenCalledWith("PUBLIC", ["kebnekaisefjallen"]);
  });

  it("leaves them off when unticked", async () => {
    const onClose = renderGuide();
    await toNotificationStep();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Notis när farograden ändras i mina områden" }));
    fireEvent.click(screen.getByRole("button", { name: /Klar/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(push.enablePush).not.toHaveBeenCalled();
  });

  it("stays open and says why if the browser refuses", async () => {
    push.enablePush.mockRejectedValueOnce(new Error("Notiser är blockerade i webbläsaren."));
    const onClose = renderGuide();
    await toNotificationStep();
    await screen.findByRole("checkbox", { name: "Notis när farograden ändras i mina områden" });
    fireEvent.click(screen.getByRole("button", { name: /Klar/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("blockerade");
    expect(onClose).not.toHaveBeenCalled();
  });
});
