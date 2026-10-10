import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/trip/preview-edit/route";
import { plan } from "@/tests/fixtures/workspace";

const post = (body: string) =>
  POST(new Request("http://localhost/api/trip/preview-edit", { method: "POST", body }));

describe("POST /api/trip/preview-edit refusals", () => {
  it("returns an authored refusal as a keyed notice beside the English error", async () => {
    const response = await post(
      JSON.stringify({ plan, baseVersion: 5, operation: { kind: "verify", day: 1 } }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "This edit is stale. Start from the current plan.",
      notice: { key: "This edit is stale. Start from the current plan." },
    });
  });

  it("returns an error that is not a notice as raw text", async () => {
    const response = await post("not json");
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(typeof body.error).toBe("string");
    expect(body.notice).toEqual({ raw: body.error });
  });
});
