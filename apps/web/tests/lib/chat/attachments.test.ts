import { describe, expect, it, vi } from "vitest";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_IMAGE_BASE64_LENGTH,
  MAX_TEXT_ATTACHMENT_BYTES,
} from "@trip/shared";
import {
  IMAGE_MAX_EDGE,
  MAX_TOTAL_ATTACHMENT_PAYLOAD,
  fitWithin,
  formatBytes,
  mediaTypeOf,
  prepareAttachments,
  truncateText,
  type ImageRenderer,
  MAX_TEXT_FILE_BYTES,
} from "@/lib/chat/attachments";
import { noticeText, type Notice } from "@/lib/i18n/notice";

/** A rejection's reason as the traveller reads it in each interface language. */
const read = (reason: Notice | undefined) =>
  reason ? { en: noticeText("en", reason), zh: noticeText("zh", reason) } : undefined;

/** Base64 of `length` characters, which is what the payload limits are measured in. */
const payload = (length: number) => "A".repeat(length - (length % 4));

/**
 * A stand-in for the canvas: jsdom draws nothing, so the renderer is injected.
 * It answers with a payload whose size falls with the requested edge, which is
 * what the downscale ladder is supposed to walk.
 */
function fakeRenderer(sizeFor: (maxEdge: number) => number): ImageRenderer {
  return (_file, { maxEdge, format }) =>
    Promise.resolve(
      `data:image/${format === "jpeg" ? "jpeg" : "png"};base64,${payload(sizeFor(maxEdge))}`,
    );
}

const image = (name = "kyoto.png", type = "image/png") =>
  new File(["binary"], name, { type });
const textFile = (name: string, type: string, body: string) =>
  new File([body], name, { type });

let counter = 0;
const newId = () => `id-${(counter += 1)}`;
const options = (render: ImageRenderer, extra: Record<string, unknown> = {}) => ({
  render,
  newId,
  ...extra,
});

describe("fitWithin", () => {
  it("scales the longest side down to the bound and keeps the aspect ratio", () => {
    expect(fitWithin(4032, 3024, IMAGE_MAX_EDGE)).toEqual({ width: 1024, height: 768 });
    expect(fitWithin(3024, 4032, IMAGE_MAX_EDGE)).toEqual({ width: 768, height: 1024 });
  });

  it("leaves an image already inside the bound alone rather than upscaling it", () => {
    expect(fitWithin(640, 480, IMAGE_MAX_EDGE)).toEqual({ width: 640, height: 480 });
  });

  it("never rounds a very wide image down to zero pixels", () => {
    expect(fitWithin(8000, 3, 1024)).toEqual({ width: 1024, height: 1 });
  });
});

describe("truncateText", () => {
  it("leaves a file inside the limit exactly as it was", () => {
    const { text, truncated } = truncateText("day one: Kyoto", "notes.md");
    expect(truncated).toBe(false);
    expect(text).toBe("day one: Kyoto");
  });

  it("cuts an oversized file to the limit and says so in the text itself", () => {
    const { text, truncated } = truncateText("x".repeat(80_000), "notes.md");
    expect(truncated).toBe(true);
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(MAX_TEXT_ATTACHMENT_BYTES);
    expect(text).toContain("Truncated");
    expect(text).toContain("notes.md");
  });

  it("measures UTF-8 bytes, not characters, and never cuts a character in half", () => {
    const { text, truncated } = truncateText("京".repeat(200), "kanji.txt", 120);
    expect(truncated).toBe(true);
    expect(new TextEncoder().encode(text).length).toBeLessThanOrEqual(120);
    expect(text).not.toContain("�");
  });
});

describe("prepareAttachments", () => {
  it("re-encodes an image and sends bare base64 with no data: prefix", async () => {
    const render = fakeRenderer(() => 1000);
    const { attachments, rejections } = await prepareAttachments([image()], options(render));

    expect(rejections).toEqual([]);
    expect(attachments).toHaveLength(1);
    const [only] = attachments;
    expect(only?.kind).toBe("image");
    expect(only?.mediaType).toBe("image/png");
    expect(only?.data.startsWith("data:")).toBe(false);
    expect(only?.thumbnail?.startsWith("data:image/")).toBe(true);
  });

  it("walks down the ladder until the encoded image fits the per-image limit", async () => {
    const seen: number[] = [];
    const render: ImageRenderer = (_file, { maxEdge }) => {
      seen.push(maxEdge);
      // Only the third rung is small enough.
      const size = maxEdge >= IMAGE_MAX_EDGE ? MAX_IMAGE_BASE64_LENGTH + 4 : 900;
      return Promise.resolve(`data:image/jpeg;base64,${payload(size)}`);
    };

    const { attachments } = await prepareAttachments([image()], options(render));

    expect(seen.slice(0, 3)).toEqual([IMAGE_MAX_EDGE, IMAGE_MAX_EDGE, 768]);
    expect(attachments[0]?.data.length).toBeLessThanOrEqual(MAX_IMAGE_BASE64_LENGTH);
  });

  it("refuses an image that is still too large at the bottom of the ladder", async () => {
    const render = fakeRenderer(() => MAX_IMAGE_BASE64_LENGTH + 4);

    const { attachments, rejections } = await prepareAttachments([image()], options(render));

    expect(attachments).toEqual([]);
    expect(rejections[0]?.name).toBe("kyoto.png");
    expect(read(rejections[0]?.reason)?.en).toContain("too large");
  });

  it("refuses a type this app cannot send, and keeps the rest of the pick", async () => {
    const render = fakeRenderer(() => 800);
    const files = [
      new File(["MZ"], "itinerary.exe", { type: "application/x-msdownload" }),
      textFile("notes.md", "text/markdown", "day one"),
    ];

    const { attachments, rejections } = await prepareAttachments(files, options(render));

    expect(rejections.map(({ name, reason }) => ({ name, reason: read(reason) }))).toEqual([
      {
        name: "itinerary.exe",
        reason: { en: "that file type can't be attached", zh: "无法添加此类型文件" },
      },
    ]);
    expect(attachments.map((a) => a.name)).toEqual(["notes.md"]);
    expect(attachments[0]?.data).toBe("day one");
  });

  it("truncates an oversized text file rather than refusing it", async () => {
    const render = fakeRenderer(() => 800);
    const big = textFile("log.txt", "text/plain", "x".repeat(MAX_TEXT_ATTACHMENT_BYTES + 5000));

    const { attachments } = await prepareAttachments([big], options(render));

    expect(attachments[0]?.truncated).toBe(true);
    expect(new TextEncoder().encode(attachments[0]?.data ?? "").length).toBeLessThanOrEqual(
      MAX_TEXT_ATTACHMENT_BYTES,
    );
  });

  it("stops at the per-message count, counting what the composer already holds", async () => {
    const render = fakeRenderer(() => 800);
    const files = Array.from({ length: 3 }, (_, index) => image(`photo-${index}.png`));

    const { attachments, rejections } = await prepareAttachments(
      files,
      options(render, { held: MAX_ATTACHMENTS_PER_MESSAGE - 1 }),
    );

    expect(attachments).toHaveLength(1);
    expect(rejections).toHaveLength(2);
    expect(read(rejections[0]?.reason)).toEqual({
      en: "only 4 files can be attached to one message",
      zh: "每条消息最多添加 4 个文件",
    });
  });

  it("spends a shared payload budget across the message, scaling further before refusing", async () => {
    // A ladder that drops sharply, so a file with less budget left lands on a
    // lower rung instead of being refused.
    const render = fakeRenderer((maxEdge) =>
      maxEdge >= IMAGE_MAX_EDGE ? 1_400_000 : maxEdge >= 768 ? 1_200_000 : 900_000,
    );
    const files = [image("one.png"), image("two.png"), image("three.png")];

    const { attachments } = await prepareAttachments(files, options(render));

    const total = attachments.reduce((sum, item) => sum + item.data.length, 0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_ATTACHMENT_PAYLOAD);
    expect(attachments).toHaveLength(3);
    // The first image takes the full-size rung; the last is squeezed smaller
    // because only the rest of the budget was left for it.
    expect(attachments[0]?.data.length).toBeGreaterThan(
      attachments[attachments.length - 1]?.data.length ?? 0,
    );
  });

  it("refuses a file once the message's shared budget is spent", async () => {
    const render = fakeRenderer(() => MAX_IMAGE_BASE64_LENGTH);

    const { attachments, rejections } = await prepareAttachments(
      [image("one.png"), image("two.png")],
      options(render, { spent: MAX_TOTAL_ATTACHMENT_PAYLOAD - MAX_IMAGE_BASE64_LENGTH }),
    );

    expect(attachments).toHaveLength(1);
    expect(rejections[0]?.name).toBe("two.png");
    expect(read(rejections[0]?.reason)).toEqual({
      en: "these files together would pass the 3.8 MB one message can carry",
      zh: "这些文件合计超过单条消息的 3.8 MB 限制",
    });
  });

  it("refuses a text file too large to read, naming the limit", async () => {
    const huge = textFile("dump.csv", "text/csv", "x");
    Object.defineProperty(huge, "size", { value: MAX_TEXT_FILE_BYTES + 1 });

    const { attachments, rejections } = await prepareAttachments([huge], options(fakeRenderer(() => 800)));

    expect(attachments).toEqual([]);
    expect(read(rejections[0]?.reason)).toEqual({
      en: "text files over 2.0 MB can't be attached",
      zh: "无法添加超过 2.0 MB 的文本文件",
    });
  });

  it("reads a .md picked with no declared type from its extension", () => {
    expect(mediaTypeOf(new File(["#"], "notes.md", { type: "" }))).toBe("text/markdown");
    expect(mediaTypeOf(new File(["{}"], "trip.json", { type: "" }))).toBe("application/json");
    expect(mediaTypeOf(new File([""], "mystery", { type: "" }))).toBe("");
  });

  it("reports a file that could not be read instead of dropping it silently", async () => {
    // A browser failure's own message is not written for travellers, so it is not shown.
    const render = vi.fn().mockRejectedValue(new DOMException("EncodingError: decode failed"));

    const { attachments, rejections } = await prepareAttachments([image()], options(render));

    expect(attachments).toEqual([]);
    expect(read(rejections[0]?.reason)).toEqual({
      en: "the file could not be read",
      zh: "无法读取文件",
    });
  });
});

describe("formatBytes", () => {
  it("reads as a size a person would write", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(1_500_000)).toBe("1.4 MB");
  });
});
