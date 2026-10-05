import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminBadge from "./AdminBadge";

describe("AdminBadge", () => {
  it("shows the label for admins only", () => {
    const { rerender } = render(<AdminBadge show />);
    expect(screen.getByTitle("Administratör för Snöläge")).toHaveTextContent("Admin");
    rerender(<AdminBadge show={false} />);
    expect(screen.queryByText("Admin")).toBeNull();
  });
});
