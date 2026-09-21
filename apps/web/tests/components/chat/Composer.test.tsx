import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "@/components/chat/Composer";

function renderComposer(overrides: Partial<Parameters<typeof Composer>[0]> = {}) {
  const onSend = vi.fn();
  const onInput = vi.fn();
  const onCancel = vi.fn();
  const onAttachFiles = vi.fn();
  const inputRef = createRef<HTMLTextAreaElement>();
  const { container } = render(
    <Composer
      value="Plan Kyoto"
      placeholder="Destination, dates, travellers and budget…"
      busy={false}
      canSend
      canCancel
      hint="Enter to send"
      inputRef={inputRef}
      onInput={onInput}
      onSend={onSend}
      onCancel={onCancel}
      onAttachFiles={onAttachFiles}
      {...overrides}
    />,
  );
  return { onSend, onInput, onCancel, onAttachFiles, inputRef, container };
}

function filePicker(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('input[type="file"]');
}

describe("composer", () => {
  it("keeps the field and the send action reachable by name", () => {
    const { onSend } = renderComposer();

    expect(screen.getByRole("textbox", { name: "Message AI Trip Planner" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("sends on Enter and keeps Shift+Enter as a newline", () => {
    const { onSend } = renderComposer();
    const field = screen.getByRole("textbox", { name: "Message AI Trip Planner" });

    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("does not send an empty draft, or one still being composed by an IME", () => {
    const { onSend } = renderComposer({ canSend: false, value: "" });
    const field = screen.getByRole("textbox", { name: "Message AI Trip Planner" });

    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("swaps the primary action for Stop while a request is in flight", () => {
    const { onCancel, onSend } = renderComposer({ busy: true });

    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Stop planning" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("reports the draft it was given and never owns the value itself", () => {
    const { onInput } = renderComposer({ value: "" });

    fireEvent.change(screen.getByRole("textbox", { name: "Message AI Trip Planner" }), {
      target: { value: "Add a food market" },
    });

    expect(onInput).toHaveBeenCalledWith("Add a food market");
  });

  it("keeps the hint copy on the control row", () => {
    renderComposer({ hint: "Planning…" });

    expect(screen.getByText("Planning…")).toBeTruthy();
  });

  it("opens the file dialog from the Upload files control", () => {
    const { container } = renderComposer();
    const picker = filePicker(container);
    expect(picker).not.toBeNull();
    const click = vi.spyOn(picker as HTMLInputElement, "click");

    fireEvent.click(screen.getByRole("button", { name: "Upload files" }));

    expect(click).toHaveBeenCalledTimes(1);
  });

  it("hands picked files to onAttachFiles, then clears the field", () => {
    const { container, onAttachFiles } = renderComposer();
    const picker = filePicker(container) as HTMLInputElement;
    expect(picker.multiple).toBe(true);

    const file = new File(["kyoto"], "kyoto.png", { type: "image/png" });
    Object.defineProperty(picker, "files", { value: [file], configurable: true });
    const cleared = vi.fn();
    Object.defineProperty(picker, "value", {
      configurable: true,
      get: () => "",
      set: cleared,
    });

    fireEvent.change(picker);

    expect(onAttachFiles).toHaveBeenCalledWith([file]);
    // The reset is what lets the same file be picked a second time.
    expect(cleared).toHaveBeenCalledWith("");
  });

  it("locks the attach control while a request is in flight", () => {
    const { container } = renderComposer({ busy: true });

    expect((screen.getByRole("button", { name: "Upload files" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((filePicker(container) as HTMLInputElement).disabled).toBe(true);
  });

  it("renders no model picker, permission chip or context meter", () => {
    renderComposer();

    expect(
      screen.queryByRole("button", { name: /model|permission|access|context|token/i }),
    ).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
