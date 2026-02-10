import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TagInput from "@/components/tag-input";

describe("TagInput", () => {
  it("renders existing tags as badges", () => {
    render(<TagInput tags={["alpha", "beta"]} onChange={vi.fn()} />);
    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("adds a tag on Enter key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput tags={[]} onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: /tag input/i });
    await user.type(input, "new-tag{Enter}");

    expect(onChange).toHaveBeenCalledWith(["new-tag"]);
  });

  it("adds a tag on comma key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput tags={[]} onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: /tag input/i });
    await user.type(input, "my-tag,");

    expect(onChange).toHaveBeenCalledWith(["my-tag"]);
  });

  it("normalizes tags to lowercase and trims whitespace", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput tags={[]} onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: /tag input/i });
    await user.type(input, "  Analytics {Enter}");

    expect(onChange).toHaveBeenCalledWith(["analytics"]);
  });

  it("deduplicates tags", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput tags={["existing"]} onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: /tag input/i });
    await user.type(input, "existing{Enter}");

    // onChange should NOT be called because tag already exists
    expect(onChange).not.toHaveBeenCalled();
  });

  it("removes a tag when X button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput tags={["alpha", "beta"]} onChange={onChange} />);

    const removeButton = screen.getByRole("button", { name: /remove alpha/i });
    await user.click(removeButton);

    expect(onChange).toHaveBeenCalledWith(["beta"]);
  });

  it("removes last tag on Backspace when input is empty", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TagInput tags={["alpha", "beta"]} onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: /tag input/i });
    await user.click(input);
    await user.keyboard("{Backspace}");

    expect(onChange).toHaveBeenCalledWith(["alpha"]);
  });

  it("shows suggestions that match input", async () => {
    const user = userEvent.setup();
    render(
      <TagInput
        tags={[]}
        onChange={vi.fn()}
        suggestions={["analytics", "salesforce", "workday"]}
      />
    );

    const input = screen.getByRole("textbox", { name: /tag input/i });
    await user.type(input, "ana");

    expect(screen.getByText("analytics")).toBeInTheDocument();
    // salesforce and workday don't match "ana"
    expect(screen.queryByText("salesforce")).not.toBeInTheDocument();
  });

  it("disables input when disabled prop is true", () => {
    render(<TagInput tags={["alpha"]} onChange={vi.fn()} disabled />);

    const input = screen.getByRole("textbox", { name: /tag input/i });
    expect(input).toBeDisabled();
    // No remove button when disabled
    expect(screen.queryByRole("button", { name: /remove alpha/i })).not.toBeInTheDocument();
  });
});
