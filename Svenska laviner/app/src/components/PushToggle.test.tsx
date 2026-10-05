import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FavoritesProvider from "../favorites/FavoritesProvider";
import { useFavorites } from "../favorites/useFavorites";
import PushToggle from "./PushToggle";

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

/** Stars Riksgränsfjällen, as a user would elsewhere in the app. */
function StarRiksgransen() {
  const { toggleFavorite } = useFavorites();
  return <button onClick={() => toggleFavorite("riksgransfjallen")}>stjärna</button>;
}

function renderToggle() {
  return render(
    <FavoritesProvider>
      <StarRiksgransen />
      <PushToggle />
    </FavoritesProvider>
  );
}

const label = "Notis när farograden ändras i mina områden";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("CapacitorStorage.fjallkoll:favorites", JSON.stringify(["kebnekaisefjallen"]));
  Object.values(push).forEach((fn) => fn.mockClear());
  push.fetchPushKey.mockResolvedValue("PUBLIC");
  push.regionPushEnabled.mockResolvedValue(false);
});

describe("PushToggle", () => {
  it("stays hidden while the server hasn't enabled notifications", async () => {
    push.fetchPushKey.mockResolvedValue(null);
    renderToggle();
    await act(async () => {});
    expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
  });

  it("subscribes for the starred regions when ticked", async () => {
    renderToggle();
    const box = await screen.findByLabelText(label);
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    await waitFor(() => expect(box).toBeChecked());
    expect(push.enablePush).toHaveBeenCalledWith("PUBLIC", ["kebnekaisefjallen"]);
  });

  it("follows changes to the favourites once on", async () => {
    push.regionPushEnabled.mockResolvedValue(true);
    renderToggle();
    await waitFor(() => expect(screen.getByLabelText(label)).toBeChecked());
    fireEvent.click(screen.getByRole("button", { name: "stjärna" }));
    await waitFor(() =>
      expect(push.updatePushRegions).toHaveBeenLastCalledWith(["kebnekaisefjallen", "riksgransfjallen"])
    );
  });

  it("shows why it couldn't turn on", async () => {
    push.enablePush.mockRejectedValueOnce(new Error("Notiser är blockerade för den här sidan."));
    renderToggle();
    fireEvent.click(await screen.findByLabelText(label));
    expect(await screen.findByRole("alert")).toHaveTextContent("blockerade");
  });
});
