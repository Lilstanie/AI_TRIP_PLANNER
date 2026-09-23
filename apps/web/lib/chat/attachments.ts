/**
 * Turns files the traveller picked, dropped or pasted into the attachment shape
 * `POST /api/chat` accepts. Nothing here touches React or the DOM tree: the
 * browser work is confined to one injectable renderer, so the rules — which
 * types are allowed, how many fit, how far an image is downscaled, where a text
 * file is cut — are testable without a canvas.
 *
 * Images are re-encoded rather than forwarded: a phone photo is several
 * megabytes, and the request carries every attachment inline as base64. A
 * picture with transparency stays PNG until that no longer fits, because
 * flattening a screenshot onto white is a visible change to what was sent.
 */

import {
  IMAGE_MEDIA_TYPES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_IMAGE_BASE64_LENGTH,
  MAX_TEXT_ATTACHMENT_BYTES,
  TEXT_MEDIA_TYPES,
  type Attachment,
} from "@trip/shared";

/** Longest side of a sent image, in CSS pixels; DSH's intake uses the same order. */
export const IMAGE_MAX_EDGE = 1024;
/** Longest side of the thumbnail kept for the chip and the stored message. */
export const THUMBNAIL_MAX_EDGE = 256;
/** Baseline lossy quality; the retry ladder below lowers it only if it must. */
export const IMAGE_QUALITY = 0.8;
/**
 * A text file larger than this is refused instead of read. Truncation is the
 * rule for an ordinary oversized file; reading a hundred megabytes into memory
 * to throw all but 32 KB of it away is not.
 */
export const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
/**
 * What every attachment on one message may carry between them, in payload
 * characters. Four maximum-size images would be 6 MB of JSON, and the platform
 * in front of the API refuses a request body over 4.5 MB before the handler
 * runs — a 413 with nothing in it to explain. So the budget is spent here,
 * where a file can still be scaled further or refused with a sentence.
 */
export const MAX_TOTAL_ATTACHMENT_PAYLOAD = 4_000_000;
/** Below this, a text file's share of the budget is too small to be worth sending. */
const MIN_TEXT_BUDGET = 1024;

/** A file the composer is holding, ready to send. */
export type PreparedAttachment = Attachment & {
  /** Stable identity for the chip's key and its remove control. */
  id: string;
  /** Size of what will be sent, in bytes — not the size of the file on disk. */
  bytes: number;
  /** Small data URL shown in the chip and stored with the sent message; images only. */
  thumbnail?: string;
  /** True when only the head of a text file was taken. */
  truncated?: boolean;
};

/** One file that could not be attached, with the reason to show beside the composer. */
export type AttachmentRejection = { name: string; reason: string };

export type PrepareResult = {
  attachments: PreparedAttachment[];
  rejections: AttachmentRejection[];
};

/** What the renderer is asked for; `format: "jpeg"` is the last-resort flatten. */
export type RenderRequest = { maxEdge: number; quality: number; format: "auto" | "jpeg" };
/** Re-encodes one image file and returns a `data:` URL. Injectable for tests. */
export type ImageRenderer = (file: File, request: RenderRequest) => Promise<string>;

const EXTENSION_MEDIA_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  json: "application/json",
};

/** The ladder tried in order until the encoded image fits the payload limit. */
const IMAGE_ATTEMPTS: RenderRequest[] = [
  { maxEdge: IMAGE_MAX_EDGE, quality: IMAGE_QUALITY, format: "auto" },
  { maxEdge: IMAGE_MAX_EDGE, quality: 0.6, format: "auto" },
  { maxEdge: 768, quality: 0.55, format: "jpeg" },
  { maxEdge: 512, quality: 0.5, format: "jpeg" },
  { maxEdge: 384, quality: 0.45, format: "jpeg" },
];

/** "1.2 MB" for a chip's second line. Bytes below a kilobyte are shown as bytes. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** The uppercase extension shown on a text chip's glyph, e.g. "MD". */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toUpperCase().slice(0, 4) : "FILE";
}

/**
 * The media type to judge the file by. A `.md` or `.csv` picked on Windows
 * often arrives with an empty `type`, so the extension is consulted before the
 * file is called unsupported.
 */
export function mediaTypeOf(file: File): string {
  const declared = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (declared) return declared;
  const dot = file.name.lastIndexOf(".");
  const extension = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  return EXTENSION_MEDIA_TYPES[extension] ?? "";
}

/** "image", "text", or undefined for a type this app does not send. */
export function attachmentKind(mediaType: string): Attachment["kind"] | undefined {
  if ((IMAGE_MEDIA_TYPES as readonly string[]).includes(mediaType)) return "image";
  if ((TEXT_MEDIA_TYPES as readonly string[]).includes(mediaType)) return "text";
  return undefined;
}

/**
 * The size a picture is drawn at so its longest side is at most `maxEdge`. An
 * image already inside the bound keeps its own size: upscaling adds bytes and
 * no detail.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest === 0) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * The head of a text file that fits `maxBytes`, measured in UTF-8 bytes rather
 * than characters, with a marker saying what was left behind. The marker is
 * counted inside the budget, so the result never exceeds the limit the server
 * enforces.
 */
export function truncateText(
  text: string,
  name: string,
  maxBytes: number = MAX_TEXT_ATTACHMENT_BYTES,
): { text: string; truncated: boolean } {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  if (bytes.length <= maxBytes) return { text, truncated: false };
  const marker = `\n\n[Truncated: only the first ${formatBytes(maxBytes)} of ${name} was sent.]`;
  const room = Math.max(0, maxBytes - encoder.encode(marker).length);
  // A cut inside a multi-byte character decodes to U+FFFD; drop that remnant
  // rather than sending a broken glyph as the last thing the model reads.
  const head = new TextDecoder().decode(bytes.slice(0, room)).replace(/�+$/u, "");
  return { text: head + marker, truncated: true };
}

/** Splits `data:image/jpeg;base64,AAA` into its media type and its payload. */
export function parseDataUrl(url: string): { mediaType: string; data: string } {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url);
  if (!match) throw new Error("The image could not be read.");
  const [, mediaType = "", base64, payload = ""] = match;
  if (base64) return { mediaType, data: payload };
  // A renderer may hand back an unencoded data URL; the contract wants base64.
  const bytes = new TextEncoder().encode(decodeURIComponent(payload));
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]!);
  return { mediaType, data: btoa(binary) };
}

/**
 * Prepares `files` for sending, refusing whatever cannot go.
 *
 * `held` is how many attachments the composer already carries, so the per-message
 * cap is enforced across separate picks rather than per pick.
 */
export async function prepareAttachments(
  files: readonly File[],
  {
    held = 0,
    spent = 0,
    render = renderImageInBrowser,
    newId = () => crypto.randomUUID(),
  }: {
    held?: number;
    /** Payload characters the already-held attachments account for. */
    spent?: number;
    render?: ImageRenderer;
    newId?: () => string;
  } = {},
): Promise<PrepareResult> {
  const attachments: PreparedAttachment[] = [];
  const rejections: AttachmentRejection[] = [];
  let used = spent;
  for (const file of files) {
    if (held + attachments.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
      rejections.push({
        name: file.name,
        reason: `only ${MAX_ATTACHMENTS_PER_MESSAGE} files can be attached to one message`,
      });
      continue;
    }
    const mediaType = mediaTypeOf(file);
    const kind = attachmentKind(mediaType);
    if (!kind) {
      rejections.push({ name: file.name, reason: "that file type can't be attached" });
      continue;
    }
    // What is left of the message's shared budget decides how hard this file is
    // squeezed: an image takes the first rung of the ladder that fits it.
    const budget = MAX_TOTAL_ATTACHMENT_PAYLOAD - used;
    if (budget <= MIN_TEXT_BUDGET) {
      rejections.push({
        name: file.name,
        reason: `these files together would pass the ${formatBytes(MAX_TOTAL_ATTACHMENT_PAYLOAD)} one message can carry`,
      });
      continue;
    }
    try {
      const prepared =
        kind === "image"
          ? await prepareImage(file, mediaType, render, newId(), budget)
          : await prepareTextFile(file, mediaType, newId(), budget);
      used += prepared.data.length;
      attachments.push(prepared);
    } catch (failure) {
      rejections.push({
        name: file.name,
        reason: failure instanceof Error ? failure.message : "the file could not be read",
      });
    }
  }
  return { attachments, rejections };
}

async function prepareImage(
  file: File,
  sourceType: string,
  render: ImageRenderer,
  id: string,
  budget: number,
): Promise<PreparedAttachment> {
  const cap = Math.min(MAX_IMAGE_BASE64_LENGTH, budget);
  let encoded: { mediaType: string; data: string } | undefined;
  for (const attempt of IMAGE_ATTEMPTS) {
    const { mediaType, data } = parseDataUrl(await render(file, attempt));
    if (data.length <= cap) {
      encoded = { mediaType, data };
      break;
    }
  }
  if (!encoded)
    throw new Error(
      cap < MAX_IMAGE_BASE64_LENGTH
        ? "there isn't room left on this message for another image"
        : "the image is too large to send, even after it was scaled down",
    );
  // The thumbnail is what the chip shows and what the sent message keeps in
  // storage; the full image is never written there.
  const thumbnail = await render(file, {
    maxEdge: THUMBNAIL_MAX_EDGE,
    quality: 0.6,
    format: "auto",
  }).catch(() => undefined);
  return {
    id,
    name: file.name || `image.${sourceType.split("/")[1] ?? "png"}`,
    mediaType: encoded.mediaType,
    kind: "image",
    data: encoded.data,
    // base64 carries 3 bytes in every 4 characters.
    bytes: Math.round((encoded.data.length * 3) / 4),
    ...(thumbnail ? { thumbnail } : {}),
  };
}

async function prepareTextFile(
  file: File,
  mediaType: string,
  id: string,
  budget: number,
): Promise<PreparedAttachment> {
  if (file.size > MAX_TEXT_FILE_BYTES)
    throw new Error(`text files over ${formatBytes(MAX_TEXT_FILE_BYTES)} can't be attached`);
  const { text, truncated } = truncateText(
    await readFileText(file),
    file.name || "the file",
    Math.min(MAX_TEXT_ATTACHMENT_BYTES, budget),
  );
  return {
    id,
    name: file.name || "note.txt",
    mediaType,
    kind: "text",
    data: text,
    bytes: new TextEncoder().encode(text).length,
    ...(truncated ? { truncated: true } : {}),
  };
}

/**
 * `File.text()` is standard in every browser this app runs in but absent from
 * jsdom's File, where the unit lane builds its fixtures; FileReader is there.
 */
function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("the file could not be read"));
    reader.readAsText(file);
  });
}

/**
 * The browser half: draw the picture into a canvas at the requested bound and
 * read it back as a data URL. Transparency survives as PNG while the payload
 * limit allows it; `format: "jpeg"` is the ladder's last rung and flattens onto
 * white, because a JPEG of a transparent PNG otherwise renders its background
 * as black.
 */
export const renderImageInBrowser: ImageRenderer = async (file, { maxEdge, quality, format }) => {
  const source = await decodeImage(file);
  const { width, height } = fitWithin(source.width, source.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("this browser could not read the image");
  const keepAlpha = format === "auto" && mayHaveAlpha(file.type);
  if (!keepAlpha) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(source as CanvasImageSource, 0, 0, width, height);
  if ("close" in source) source.close();
  const transparent = keepAlpha && hasTransparentPixel(context, width, height);
  return canvas.toDataURL(transparent ? "image/png" : "image/jpeg", quality);
};

/** Only these source types can carry an alpha channel worth preserving. */
const mayHaveAlpha = (type: string) =>
  type === "image/png" || type === "image/webp" || type === "image/gif";

function hasTransparentPixel(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): boolean {
  let pixels: Uint8ClampedArray;
  try {
    pixels = context.getImageData(0, 0, width, height).data;
  } catch {
    // A tainted canvas cannot be read back. Keep PNG: it is the lossless answer.
    return true;
  }
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index] !== 255) return true;
  return false;
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("the image could not be read"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
