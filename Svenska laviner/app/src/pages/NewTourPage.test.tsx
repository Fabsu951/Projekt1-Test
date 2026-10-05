import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import NewTourPage from "./NewTourPage";

const { createTour } = vi.hoisted(() => ({ createTour: vi.fn() }));
vi.mock("../services/tourService", () => ({ createTour }));
vi.mock("../components/TrackMap", () => ({ default: () => <div data-testid="track-map" /> }));
vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({
    user: { id: 1, email: "a@b.se", displayName: "A", isAdmin: false, emailVerified: true, canPost: true },
    token: "t",
    loading: false,
  }),
}));

const GPX = `<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>
  <trkpt lat="67.851" lon="18.597"><ele>700</ele><time>2027-03-10T08:00:00Z</time></trkpt>
  <trkpt lat="67.860" lon="18.590"><ele>820</ele><time>2027-03-10T08:30:00Z</time></trkpt>
</trkseg></trk></gpx>`;

describe("NewTourPage", () => {
  it("reads a GPX file, shows it, and saves it visible to everyone with 500 m hidden by default", async () => {
    createTour.mockResolvedValue({ id: 42 });
    render(
      <MemoryRouter initialEntries={["/turer/ny"]}>
        <Routes>
          <Route path="/turer/ny" element={<NewTourPage />} />
          <Route path="/turer/:id" element={<p>Turens sida</p>} />
        </Routes>
      </MemoryRouter>
    );

    const file = new File([GPX], "Kebnekaise_sydtopp.gpx", { type: "application/gpx+xml" });
    fireEvent.change(screen.getByLabelText(/Spårfil/), { target: { files: [file] } });
    expect(await screen.findByTestId("track-map")).toBeInTheDocument();
    expect(screen.getByLabelText("Titel")).toHaveValue("Kebnekaise sydtopp");
    expect(screen.queryByLabelText(/Datum/)).not.toBeInTheDocument(); // the track has times

    fireEvent.click(screen.getByRole("button", { name: "Spara tur" }));
    expect(await screen.findByText("Turens sida")).toBeInTheDocument();
    await waitFor(() =>
      expect(createTour).toHaveBeenCalledWith(
        "t",
        expect.objectContaining({ title: "Kebnekaise sydtopp", visibility: "public", hideEndsM: 500, date: null })
      )
    );
    expect(createTour.mock.calls[0][1].points).toHaveLength(2);
  });
});
