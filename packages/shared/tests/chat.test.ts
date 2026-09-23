import { describe, expect, it } from "vitest";
import {
  AgentProgressEvent,
  Attachment,
  ChatRequest,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_IMAGE_BASE64_LENGTH,
  MAX_TEXT_ATTACHMENT_BYTES,
  ASK_USER_MAX_OPTIONS,
  ASK_USER_MAX_QUESTIONS,
  AskUserQuestionItem,
  ChatAskUser,
  ToolResultRow,
} from "../src/chat";

const question = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  question: `Question ${id}?`,
  ...extra,
});

describe("structured questions", () => {
  it("accepts a DSH-shaped question with choices", () => {
    const parsed = AskUserQuestionItem.parse(
      question("pace", {
        header: "Pace",
        detail: "Affects how many sights fit into a day.",
        options: [
          { label: "Relaxed (Recommended)", description: "Two sights a day." },
          { label: "Packed" },
        ],
        multiSelect: false,
      }),
    );
    expect(parsed.options?.[0]?.label).toBe("Relaxed (Recommended)");
  });

  it("accepts a free-text question with no options", () => {
    expect(AskUserQuestionItem.safeParse(question("free")).success).toBe(true);
  });

  it("refuses a blank question, a blank option label and too many options", () => {
    expect(AskUserQuestionItem.safeParse({ id: "q", question: "  " }).success).toBe(false);
    expect(
      AskUserQuestionItem.safeParse(question("q", { options: [{ label: " " }] })).success,
    ).toBe(false);
    const options = Array.from({ length: ASK_USER_MAX_OPTIONS + 1 }, (_v, i) => ({
      label: `Option ${i}`,
    }));
    expect(AskUserQuestionItem.safeParse(question("q", { options })).success).toBe(false);
  });

  it("carries one to four questions and what is known", () => {
    const frame = (count: number) => ({
      type: "ask_user",
      questions: Array.from({ length: count }, (_v, i) => question(`q${i}`)),
      known: { destination: "Tokyo" },
    });
    expect(ChatAskUser.safeParse(frame(1)).success).toBe(true);
    expect(ChatAskUser.safeParse(frame(ASK_USER_MAX_QUESTIONS)).success).toBe(true);
    expect(ChatAskUser.safeParse(frame(0)).success).toBe(false);
    expect(ChatAskUser.safeParse(frame(ASK_USER_MAX_QUESTIONS + 1)).success).toBe(false);
  });
});

describe("result row kind", () => {
  it("is optional, so rows from older emitters still parse", () => {
    expect(ToolResultRow.safeParse({ label: "Opera House" }).success).toBe(true);
    expect(ToolResultRow.safeParse({ label: "Opera House", kind: "attraction" }).success).toBe(
      true,
    );
    expect(ToolResultRow.safeParse({ label: "Opera House", kind: "castle" }).success).toBe(false);
  });

  it("carries the row's own web page, and only a real URL", () => {
    expect(
      ToolResultRow.safeParse({ label: "Harbour Hotel", url: "https://harbourhotel.example/" })
        .success,
    ).toBe(true);
    // Absent for a provider that reported no page; never a bare host or a
    // fragment a client would have to repair.
    expect(ToolResultRow.safeParse({ label: "Harbour Hotel" }).success).toBe(true);
    expect(ToolResultRow.safeParse({ label: "Harbour Hotel", url: "harbourhotel" }).success).toBe(
      false,
    );
  });

  it("travels inside a completed tool event", () => {
    const parsed = AgentProgressEvent.parse({
      type: "tool_completed",
      agent: "itinerary",
      round: 1,
      callId: "itinerary:1:1",
      tool: "booking.searchStays",
      label: "Search stays",
      resultSummary: "1 stay option",
      resultRows: [
        { label: "Harbour Hotel", kind: "stay", url: "https://harbourhotel.example/rooms" },
      ],
    });
    expect(parsed.type === "tool_completed" && parsed.resultRows?.[0]?.kind).toBe("stay");
    expect(parsed.type === "tool_completed" && parsed.resultRows?.[0]?.url).toBe(
      "https://harbourhotel.example/rooms",
    );
  });
});

const png = (data: string) => ({
  name: "hotel.png",
  mediaType: "image/png",
  kind: "image" as const,
  data,
});
const note = (data: string) => ({
  name: "booking.txt",
  mediaType: "text/plain",
  kind: "text" as const,
  data,
});
/** Valid base64 of exactly `length` characters. */
const base64 = (length: number) => "A".repeat(length);

describe("message attachments", () => {
  it("accepts a base64 image and a UTF-8 text file", () => {
    expect(Attachment.safeParse(png("iVBORw0KGgo=")).success).toBe(true);
    expect(Attachment.safeParse(note("Confirmation 12345")).success).toBe(true);
  });

  it("refuses a media type outside the allow-list, and one from the wrong kind", () => {
    expect(Attachment.safeParse({ ...png("AAAA"), mediaType: "image/tiff" }).success).toBe(false);
    expect(Attachment.safeParse({ ...note("x"), mediaType: "application/pdf" }).success).toBe(
      false,
    );
    // An image's type is not a text type and the other way round, so `kind` cannot be
    // mislabelled to smuggle a format past the allow-list.
    expect(Attachment.safeParse({ ...png("AAAA"), mediaType: "text/plain" }).success).toBe(false);
    expect(Attachment.safeParse({ ...note("x"), mediaType: "image/png" }).success).toBe(false);
  });

  it("requires an image to be bare base64, with no data: prefix", () => {
    expect(Attachment.safeParse({ ...png("data:image/png;base64,iVBORw0KGgo=") }).success).toBe(
      false,
    );
    expect(Attachment.safeParse({ ...png("iVBO Rw0K") }).success).toBe(false);
    // Base64 is whole groups of four; a truncated payload is a broken image.
    expect(Attachment.safeParse({ ...png("iVBOR") }).success).toBe(false);
  });

  it("caps an image's payload and a text file's bytes", () => {
    expect(Attachment.safeParse(png(base64(MAX_IMAGE_BASE64_LENGTH))).success).toBe(true);
    expect(Attachment.safeParse(png(base64(MAX_IMAGE_BASE64_LENGTH + 4))).success).toBe(false);
    expect(Attachment.safeParse(note("a".repeat(MAX_TEXT_ATTACHMENT_BYTES))).success).toBe(true);
    expect(Attachment.safeParse(note("a".repeat(MAX_TEXT_ATTACHMENT_BYTES + 1))).success).toBe(
      false,
    );
    // The cap is bytes, not characters: a multi-byte language fills it sooner.
    expect(Attachment.safeParse(note("東".repeat(MAX_TEXT_ATTACHMENT_BYTES / 3 + 1))).success).toBe(
      false,
    );
  });

  it("rides on a chat request, up to the per-message limit", () => {
    const request = (count: number) => ({
      tripId: "trip-1",
      message: "What is this?",
      attachments: Array.from({ length: count }, () => png("iVBORw0KGgo=")),
    });
    expect(ChatRequest.safeParse(request(MAX_ATTACHMENTS_PER_MESSAGE)).success).toBe(true);
    expect(ChatRequest.safeParse(request(MAX_ATTACHMENTS_PER_MESSAGE + 1)).success).toBe(false);
    // Absent is the ordinary case and stays valid.
    expect(ChatRequest.safeParse({ tripId: "trip-1", message: "hi" }).success).toBe(true);
  });

  it("lets a picture be the whole message, but never sends an empty turn", () => {
    const attached = { tripId: "trip-1", message: "", attachments: [png("iVBORw0KGgo=")] };
    expect(ChatRequest.safeParse(attached).success).toBe(true);
    expect(ChatRequest.safeParse({ tripId: "trip-1", message: "   " }).success).toBe(false);
    expect(ChatRequest.safeParse({ tripId: "trip-1", message: "", attachments: [] }).success).toBe(
      false,
    );
  });
});
