import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  backgroundCheckStatus: vi.fn(),
  enableBackgroundCheck: vi.fn(),
  disableBackgroundCheck: vi.fn(),
}));
vi.mock("../services/backgroundImport", () => service);

import BackgroundCheckToggle from "./BackgroundCheckToggle";

describe("BackgroundCheckToggle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is hidden where there is no background check (web, iPhone)", async () => {
    service.backgroundCheckStatus.mockResolvedValue(null);
    const { container } = render(<BackgroundCheckToggle />);
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });

  it("turns reminders on, and explains when Health Connect says no", async () => {
    service.backgroundCheckStatus.mockResolvedValue({ supported: true, on: false });
    service.enableBackgroundCheck.mockResolvedValue({ on: false, reason: "background" });
    render(<BackgroundCheckToggle />);
    const box = await screen.findByRole("checkbox", { name: /Påminn mig om nya skidpass/ });
    fireEvent.click(box);
    expect(await screen.findByRole("alert")).toHaveTextContent("Health Connect gav inte tillåtelse");
    expect(box).not.toBeChecked();

    service.enableBackgroundCheck.mockResolvedValue({ on: true });
    fireEvent.click(box);
    await vi.waitFor(() => expect(box).toBeChecked());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("asks for a newer Health Connect when it can't read in the background", async () => {
    service.backgroundCheckStatus.mockResolvedValue({ supported: false, on: false });
    render(<BackgroundCheckToggle />);
    expect(await screen.findByText(/kräver en nyare Health Connect/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
