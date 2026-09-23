import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createRef, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { MAX_ATTACHMENTS_PER_MESSAGE } from "@trip/shared";
import { Composer } from "@/components/chat/Composer";
import { useComposerAttachments } from "@/components/workspace/useComposerAttachments";
import type { ImageRenderer, PreparedAttachment } from "@/lib/chat/attachments";

/** jsdom draws nothing, so the composer's images are encoded by this instead. */
const render1px: ImageRenderer = () => Promise.resolve("data:image/jpeg;base64,AAAA");

const chip = (name: string): PreparedAttachment => ({
  id: name,
  name,
  mediaType: "image/jpeg",
  kind: "image",
  data: "AAAA",
  bytes: 3,
  thumbnail: "data:image/jpeg;base64,AAAA",
});

function renderComposer(overrides: Partial<Parameters<typeof Composer>[0]> = {}) {
  const inputRef = createRef<HTMLTextAreaElement>();
  const props = {
    value: "Plan Kyoto",
    placeholder: "Destination…",
    busy: false,
    canSend: true,
    canCancel: true,
    inputRef,
    onInput: vi.fn(),
    onSend: vi.fn(),
    onAttachFiles: vi.fn(),
    onRemoveAttachment: vi.fn(),
    ...overrides,
  };
  const { container } = render(<Composer {...props} />);
  return { ...props, container };
}

/** The composer driven by the real hook, which is what the workspace wires up. */
function LiveComposer() {
  const attachments = useComposerAttachments({ render: render1px });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  return (
    <Composer
      value=""
      placeholder="Destination…"
      busy={false}
      canSend
      canCancel={false}
      inputRef={inputRef}
      onInput={() => {}}
      onSend={() => {}}
      onAttachFiles={attachments.addFiles}
      attachments={attachments.attachments}
      onRemoveAttachment={attachments.removeAttachment}
      canAttach={attachments.canAttach}
      attachNotice={attachments.notice}
    />
  );
}

const png = (name: string) => new File(["binary"], name, { type: "image/png" });
const picker = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement;

function pick(container: HTMLElement, files: File[]) {
  const field = picker(container);
  Object.defineProperty(field, "files", { value: files, configurable: true });
  fireEvent.change(field);
}

describe("composer attachments", () => {
  it("draws a chip per held file, with its name, size and a remove control", () => {
    renderComposer({ attachments: [chip("kyoto.png")] });

    const list = screen.getByRole("list", { name: "Attached files" });
    const item = within(list).getByRole("listitem");
    expect(within(item).getByText("kyoto.png")).toBeTruthy();
    expect(within(item).getByText(/PNG · 3 B/)).toBeTruthy();
    // The thumbnail carries no alt of its own: the name sits beside it as text.
    expect(item.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(within(item).getByRole("button", { name: "Remove kyoto.png" })).toBeTruthy();
  });

  it("removes the file the remove control names", () => {
    const { onRemoveAttachment } = renderComposer({
      attachments: [chip("kyoto.png"), chip("osaka.png")],
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove osaka.png" }));

    expect(onRemoveAttachment).toHaveBeenCalledWith("osaka.png");
  });

  it("takes an image pasted from the clipboard, which has no file name to pick", () => {
    const { onAttachFiles } = renderComposer();
    const pasted = png("image.png");

    fireEvent.paste(screen.getByRole("textbox", { name: "Message AI Trip Planner" }), {
      clipboardData: { files: [pasted], types: ["Files"] },
    });

    expect(onAttachFiles).toHaveBeenCalledWith([pasted]);
  });

  it("leaves a pasted text run alone, so ordinary pasting still types", () => {
    const { onAttachFiles } = renderComposer();

    fireEvent.paste(screen.getByRole("textbox", { name: "Message AI Trip Planner" }), {
      clipboardData: { files: [], types: ["text/plain"] },
    });

    expect(onAttachFiles).not.toHaveBeenCalled();
  });

  it("takes files dropped onto the card and marks the card while one is over it", () => {
    const { onAttachFiles, container } = renderComposer();
    const card = container.querySelector(".composer") as HTMLElement;
    const dropped = png("map.png");

    fireEvent.dragEnter(card, { dataTransfer: { files: [dropped], types: ["Files"] } });
    expect(card.getAttribute("data-dragging")).toBe("true");

    fireEvent.drop(card, { dataTransfer: { files: [dropped], types: ["Files"] } });

    expect(card.getAttribute("data-dragging")).toBeNull();
    expect(onAttachFiles).toHaveBeenCalledWith([dropped]);
  });

  it("keeps the file field reachable rather than removing it from the page", () => {
    const { container } = renderComposer();
    const field = picker(container);

    expect(field.hidden).toBe(false);
    expect(field.getAttribute("aria-label")).toBe("Add files");
    expect(field.multiple).toBe(true);
  });

  it("holds picked files, then stops and explains itself at the limit", async () => {
    const { container } = render(<LiveComposer />);

    await act(async () => {
      pick(
        container,
        Array.from({ length: MAX_ATTACHMENTS_PER_MESSAGE }, (_, index) => png(`photo-${index}.png`)),
      );
    });

    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(MAX_ATTACHMENTS_PER_MESSAGE),
    );
    expect(screen.getByRole("status").textContent).toContain(
      `You can attach ${MAX_ATTACHMENTS_PER_MESSAGE} files`,
    );
    expect((screen.getByRole("button", { name: "Upload files" }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    // Removing one brings the control back and clears the explanation.
    fireEvent.click(screen.getByRole("button", { name: "Remove photo-0.png" }));
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(MAX_ATTACHMENTS_PER_MESSAGE - 1),
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect((screen.getByRole("button", { name: "Upload files" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("says why an unsupported file was refused, and keeps it out of the chips", async () => {
    const { container } = render(<LiveComposer />);

    await act(async () => {
      pick(container, [new File(["MZ"], "trip.exe", { type: "application/x-msdownload" })]);
    });

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "trip.exe wasn't attached — that file type can't be attached.",
      ),
    );
    expect(screen.queryByRole("list", { name: "Attached files" })).toBeNull();
  });
});
