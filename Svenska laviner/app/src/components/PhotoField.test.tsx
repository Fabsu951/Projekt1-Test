import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PhotoField from "./PhotoField";

const prepared = new Blob(["jpeg"], { type: "image/jpeg" });
vi.mock("../utils/image", () => ({ prepareImage: vi.fn(async () => prepared) }));

function phone(coarse: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: coarse && q.includes("coarse"), addEventListener() {}, removeEventListener() {} }));
}

describe("PhotoField", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens the camera directly on a phone and hands over the prepared photo", async () => {
    phone(true);
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
    const onChange = vi.fn();
    const { container } = render(<PhotoField onChange={onChange} onError={() => {}} />);
    const [camera, gallery] = container.querySelectorAll<HTMLInputElement>("input[type=file]");
    expect(camera.getAttribute("capture")).toBe("environment");
    expect(gallery.hasAttribute("capture")).toBe(false);
    expect(screen.getByRole("button", { name: "Ta bild" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Välj från galleriet" })).toBeTruthy();

    fireEvent.change(camera, { target: { files: [new File(["x"], "foto.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(prepared));
    expect(screen.getByAltText("Förhandsvisning av bilden")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ta bort bilden" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByAltText("Förhandsvisning av bilden")).toBeNull();
  });

  it("only offers picking a file on a computer", () => {
    phone(false);
    render(<PhotoField onChange={() => {}} onError={() => {}} />);
    expect(screen.queryByRole("button", { name: "Ta bild" })).toBeNull();
    expect(screen.getByRole("button", { name: "Välj bild" })).toBeTruthy();
  });
});
