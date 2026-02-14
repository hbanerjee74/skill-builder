import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AboutDialog } from "@/components/about-dialog";
import { mockGetVersion } from "@/test/mocks/tauri";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(() => Promise.resolve()),
}));

describe("AboutDialog", () => {
  it("renders dialog content when open", () => {
    render(<AboutDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Skill Builder")).toBeInTheDocument();
  });

  it("does not render dialog content when closed", () => {
    render(<AboutDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText("Skill Builder")).not.toBeInTheDocument();
  });

  it("shows version number from getVersion", async () => {
    mockGetVersion.mockResolvedValue("1.5.0");
    render(<AboutDialog open={true} onOpenChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Version 1.5.0")).toBeInTheDocument();
    });
  });

  it("shows 'by Accelerate Data' text", () => {
    render(<AboutDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText("Accelerate Data")).toBeInTheDocument();
  });

  it("shows app icon image", () => {
    render(<AboutDialog open={true} onOpenChange={vi.fn()} />);
    const img = screen.getByAltText("Skill Builder");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/icon-256.png");
  });
});
