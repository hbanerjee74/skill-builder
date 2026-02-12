import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockInvoke, resetTauriMocks } from "@/test/mocks/tauri";
import { toast } from "sonner";

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

import { FeedbackDialog } from "@/components/feedback-dialog";

describe("FeedbackDialog", () => {
  beforeEach(() => {
    resetTauriMocks();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("renders the feedback trigger button", () => {
    render(<FeedbackDialog />);
    expect(screen.getByTitle("Send feedback")).toBeInTheDocument();
  });

  it("opens the dialog when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    expect(screen.getByText("Send Feedback")).toBeInTheDocument();
    expect(screen.getByText(/Report a bug or request a feature/)).toBeInTheDocument();
  });

  it("renders Bug and Feature Request radio options", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    expect(screen.getByLabelText("Bug")).toBeInTheDocument();
    expect(screen.getByLabelText("Feature Request")).toBeInTheDocument();
  });

  it("renders title and description fields", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("has Cancel and Submit buttons", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit/i })).toBeInTheDocument();
  });

  it("shows error toast when submitting with empty title", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    await user.click(screen.getByRole("button", { name: /Submit/i }));

    expect(toast.error).toHaveBeenCalledWith("Please enter a title");
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("submits feedback successfully and shows success toast", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue("VD-500");

    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    await user.type(screen.getByLabelText("Title"), "App crashes on startup");
    await user.type(screen.getByLabelText("Description"), "Steps to reproduce...");
    await user.click(screen.getByRole("button", { name: /Submit/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("submit_feedback", {
        feedbackType: "bug",
        title: "App crashes on startup",
        description: "Steps to reproduce...",
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Feedback submitted (VD-500)");
    });
  });

  it("submits feature request with correct type", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue("VD-501");

    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    await user.click(screen.getByLabelText("Feature Request"));
    await user.type(screen.getByLabelText("Title"), "Add dark mode");
    await user.click(screen.getByRole("button", { name: /Submit/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("submit_feedback", {
        feedbackType: "feature",
        title: "Add dark mode",
        description: "",
      });
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Feedback submitted (VD-501)");
    });
  });

  it("shows error toast on submission failure", async () => {
    const user = userEvent.setup();
    mockInvoke.mockRejectedValue(new Error("Network error"));

    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    await user.type(screen.getByLabelText("Title"), "Something broke");
    await user.click(screen.getByRole("button", { name: /Submit/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to submit feedback: Network error",
        { duration: 5000 },
      );
    });
  });

  it("resets form when dialog is closed via Cancel", async () => {
    const user = userEvent.setup();

    render(<FeedbackDialog />);

    // Open and fill out form
    await user.click(screen.getByTitle("Send feedback"));
    await user.type(screen.getByLabelText("Title"), "Some title");
    await user.type(screen.getByLabelText("Description"), "Some description");

    // Close via Cancel
    await user.click(screen.getByRole("button", { name: /Cancel/i }));

    // Re-open and verify fields are reset
    await user.click(screen.getByTitle("Send feedback"));
    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByLabelText("Description")).toHaveValue("");
  });

  it("defaults to Bug feedback type", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    const bugRadio = screen.getByLabelText("Bug");
    expect(bugRadio).toBeChecked();
  });
});
