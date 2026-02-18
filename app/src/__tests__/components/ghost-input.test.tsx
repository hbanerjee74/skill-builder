import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GhostInput, GhostTextarea } from "@/components/ghost-input";

describe("GhostInput", () => {
  it("shows ghost suggestion text when value is empty and suggestion is provided", () => {
    render(
      <GhostInput
        suggestion="Type a skill name"
        value=""
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("Type a skill name")).toBeInTheDocument();
  });

  it("hides ghost text when value is non-empty", () => {
    render(
      <GhostInput
        suggestion="Type a skill name"
        value="my-skill"
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByText("Type a skill name")).not.toBeInTheDocument();
  });

  it("hides ghost text when suggestion is null", () => {
    render(
      <GhostInput
        suggestion={null}
        value=""
        onChange={vi.fn()}
      />
    );
    // No ghost overlay should be rendered
    const input = screen.getByRole("textbox");
    // The parent wrapper div should only contain the input, no ghost div
    expect(input.parentElement?.children.length).toBe(1);
  });

  it("hides ghost text when suggestion is an empty string", () => {
    render(
      <GhostInput
        suggestion=""
        value=""
        onChange={vi.fn()}
      />
    );
    const input = screen.getByRole("textbox");
    expect(input.parentElement?.children.length).toBe(1);
  });

  it("Tab key accepts the suggestion and calls onAccept", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    render(
      <GhostInput
        suggestion="analytics-pipeline"
        value=""
        onChange={vi.fn()}
        onAccept={onAccept}
      />
    );

    const input = screen.getByRole("textbox");
    await user.click(input);
    await user.keyboard("{Tab}");

    expect(onAccept).toHaveBeenCalledWith("analytics-pipeline");
  });

  it("Tab does nothing when no suggestion is present", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    render(
      <GhostInput
        suggestion={null}
        value=""
        onChange={vi.fn()}
        onAccept={onAccept}
      />
    );

    const input = screen.getByRole("textbox");
    await user.click(input);
    await user.keyboard("{Tab}");

    expect(onAccept).not.toHaveBeenCalled();
  });

  it("Tab does nothing when value is non-empty (ghost hidden)", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    render(
      <GhostInput
        suggestion="analytics-pipeline"
        value="my-val"
        onChange={vi.fn()}
        onAccept={onAccept}
      />
    );

    const input = screen.getByRole("textbox");
    await user.click(input);
    await user.keyboard("{Tab}");

    expect(onAccept).not.toHaveBeenCalled();
  });

  it("regular typing calls onChange, not onAccept", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onAccept = vi.fn();
    render(
      <GhostInput
        suggestion="analytics-pipeline"
        value=""
        onChange={onChange}
        onAccept={onAccept}
      />
    );

    const input = screen.getByRole("textbox");
    await user.type(input, "a");

    expect(onChange).toHaveBeenCalledWith("a");
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("forwards placeholder prop to the underlying input", () => {
    render(
      <GhostInput
        suggestion={null}
        value=""
        onChange={vi.fn()}
        placeholder="Enter name"
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("placeholder", "Enter name");
  });

  it("forwards disabled prop to the underlying input", () => {
    render(
      <GhostInput
        suggestion={null}
        value=""
        onChange={vi.fn()}
        disabled
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });

  it("forwards id prop to the underlying input", () => {
    render(
      <GhostInput
        suggestion={null}
        value=""
        onChange={vi.fn()}
        id="skill-name"
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("id", "skill-name");
  });

  it("forwards custom onKeyDown alongside ghost Tab handling", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    const onAccept = vi.fn();
    render(
      <GhostInput
        suggestion="analytics-pipeline"
        value=""
        onChange={vi.fn()}
        onAccept={onAccept}
        onKeyDown={onKeyDown}
      />
    );

    const input = screen.getByRole("textbox");
    await user.click(input);
    await user.keyboard("{Tab}");

    expect(onAccept).toHaveBeenCalledWith("analytics-pipeline");
    expect(onKeyDown).toHaveBeenCalled();
  });

  it("applies placeholder:text-transparent class when ghost is shown", () => {
    render(
      <GhostInput
        suggestion="Type a skill name"
        value=""
        onChange={vi.fn()}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input.className).toContain("placeholder:text-transparent");
  });

  it("does not apply placeholder:text-transparent class when ghost is hidden", () => {
    render(
      <GhostInput
        suggestion={null}
        value=""
        onChange={vi.fn()}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input.className).not.toContain("placeholder:text-transparent");
  });
});

describe("GhostTextarea", () => {
  it("shows ghost suggestion text when value is empty and suggestion is provided", () => {
    render(
      <GhostTextarea
        suggestion="Describe your skill"
        value=""
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("Describe your skill")).toBeInTheDocument();
  });

  it("hides ghost text when value is non-empty", () => {
    render(
      <GhostTextarea
        suggestion="Describe your skill"
        value="My skill does X"
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByText("Describe your skill")).not.toBeInTheDocument();
  });

  it("hides ghost text when suggestion is null", () => {
    render(
      <GhostTextarea
        suggestion={null}
        value=""
        onChange={vi.fn()}
      />
    );
    const textarea = screen.getByRole("textbox");
    expect(textarea.parentElement?.children.length).toBe(1);
  });

  it("Tab key accepts the suggestion and calls onAccept", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    render(
      <GhostTextarea
        suggestion="Enter a detailed description"
        value=""
        onChange={vi.fn()}
        onAccept={onAccept}
      />
    );

    const textarea = screen.getByRole("textbox");
    await user.click(textarea);
    await user.keyboard("{Tab}");

    expect(onAccept).toHaveBeenCalledWith("Enter a detailed description");
  });

  it("Tab does nothing when no suggestion is present", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    render(
      <GhostTextarea
        suggestion={null}
        value=""
        onChange={vi.fn()}
        onAccept={onAccept}
      />
    );

    const textarea = screen.getByRole("textbox");
    await user.click(textarea);
    await user.keyboard("{Tab}");

    expect(onAccept).not.toHaveBeenCalled();
  });

  it("regular typing calls onChange, not onAccept", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onAccept = vi.fn();
    render(
      <GhostTextarea
        suggestion="Describe your skill"
        value=""
        onChange={onChange}
        onAccept={onAccept}
      />
    );

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "x");

    expect(onChange).toHaveBeenCalledWith("x");
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("forwards disabled prop to the underlying textarea", () => {
    render(
      <GhostTextarea
        suggestion={null}
        value=""
        onChange={vi.fn()}
        disabled
      />
    );

    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeDisabled();
  });

  it("forwards id prop to the underlying textarea", () => {
    render(
      <GhostTextarea
        suggestion={null}
        value=""
        onChange={vi.fn()}
        id="description-field"
      />
    );

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("id", "description-field");
  });

  it("forwards custom onKeyDown alongside ghost Tab handling", async () => {
    const user = userEvent.setup();
    const onKeyDown = vi.fn();
    const onAccept = vi.fn();
    render(
      <GhostTextarea
        suggestion="Describe your skill"
        value=""
        onChange={vi.fn()}
        onAccept={onAccept}
        onKeyDown={onKeyDown}
      />
    );

    const textarea = screen.getByRole("textbox");
    await user.click(textarea);
    await user.keyboard("{Tab}");

    expect(onAccept).toHaveBeenCalledWith("Describe your skill");
    expect(onKeyDown).toHaveBeenCalled();
  });
});
