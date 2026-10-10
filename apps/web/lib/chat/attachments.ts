import {
  IMAGE_MEDIA_TYPES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_IMAGE_BASE64_LENGTH,
  MAX_TEXT_ATTACHMENT_BYTES,
  TEXT_MEDIA_TYPES,
  type Attachment,
} from "@trip/shared";

import { NoticeError, type Notice } from "@/lib/i18n/notice";

export const IMAGE_MAX_EDGE = 1024;

export const THUMBNAIL_MAX_EDGE = 256;

export const IMAGE_QUALITY = 0.8;

export const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;

export const MAX_TOTAL_ATTACHMENT_PAYLOAD = 4_000_000;

const MIN_TEXT_BUDGET = 1024;

export type PreparedAttachment = Attachment & {
  id: string;

  bytes: number;

  thumbnail?: string;

  truncated?: boolean;
};

export type AttachmentRejection = { name: string; reason: Notice };

export type PrepareResult = {
  attachments: PreparedAttachment[];
  rejections: AttachmentRejection[];
};

export type RenderRequest = { maxEdge: number; quality: number; format: "auto" | "jpeg" };

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

const IMAGE_ATTEMPTS: RenderRequest[] = [
  { maxEdge: IMAGE_MAX_EDGE, quality: IMAGE_QUALITY, format: "auto" },
  { maxEdge: IMAGE_MAX_EDGE, quality: 0.6, format: "auto" },
  { maxEdge: 768, quality: 0.55, format: "jpeg" },
  { maxEdge: 512, quality: 0.5, format: "jpeg" },
  { maxEdge: 384, quality: 0.45, format: "jpeg" },
];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0
    ? name
        .slice(dot + 1)
        .toUpperCase()
        .slice(0, 4)
    : "FILE";
}

export function mediaTypeOf(file: File): string {
  const declared = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (declared) return declared;
  const dot = file.name.lastIndexOf(".");
  const extension = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  return EXTENSION_MEDIA_TYPES[extension] ?? "";
}

export function attachmentKind(mediaType: string): Attachment["kind"] | undefined {
  if ((IMAGE_MEDIA_TYPES as readonly string[]).includes(mediaType)) return "image";
  if ((TEXT_MEDIA_TYPES as readonly string[]).includes(mediaType)) return "text";
  return undefined;
}

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

  const head = new TextDecoder().decode(bytes.slice(0, room)).replace(/�+$/u, "");
  return { text: head + marker, truncated: true };
}

export function parseDataUrl(url: string): { mediaType: string; data: string } {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(url);
  if (!match) throw new NoticeError({ key: "The image could not be read." });
  const [, mediaType = "", base64, payload = ""] = match;
  if (base64) return { mediaType, data: payload };

  const bytes = new TextEncoder().encode(decodeURIComponent(payload));
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1)
    binary += String.fromCharCode(bytes[index]!);
  return { mediaType, data: btoa(binary) };
}

export async function prepareAttachments(
  files: readonly File[],
  {
    held = 0,
    spent = 0,
    render = renderImageInBrowser,
    newId = () => crypto.randomUUID(),
  }: {
    held?: number;

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
        reason: {
          key: "only {count} files can be attached to one message",
          params: { count: MAX_ATTACHMENTS_PER_MESSAGE },
        },
      });
      continue;
    }
    const mediaType = mediaTypeOf(file);
    const kind = attachmentKind(mediaType);
    if (!kind) {
      rejections.push({ name: file.name, reason: { key: "that file type can't be attached" } });
      continue;
    }

    const budget = MAX_TOTAL_ATTACHMENT_PAYLOAD - used;
    if (budget <= MIN_TEXT_BUDGET) {
      rejections.push({
        name: file.name,
        reason: {
          key: "these files together would pass the {size} one message can carry",
          params: { size: formatBytes(MAX_TOTAL_ATTACHMENT_PAYLOAD) },
        },
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

        reason:
          failure instanceof NoticeError ? failure.notice : { key: "the file could not be read" },
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
    throw new NoticeError(
      cap < MAX_IMAGE_BASE64_LENGTH
        ? { key: "there isn't room left on this message for another image" }
        : { key: "the image is too large to send, even after it was scaled down" },
    );

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
    throw new NoticeError({
      key: "text files over {size} can't be attached",
      params: { size: formatBytes(MAX_TEXT_FILE_BYTES) },
    });
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

function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("the file could not be read"));
    reader.readAsText(file);
  });
}

export const renderImageInBrowser: ImageRenderer = async (file, { maxEdge, quality, format }) => {
  const source = await decodeImage(file);
  const { width, height } = fitWithin(source.width, source.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new NoticeError({ key: "this browser could not read the image" });
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
