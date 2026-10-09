import { parseDataMode } from "@trip/tools";
import { errorNotice, noticeBody } from "@/lib/i18n/notice";
import { LIVE_EDIT_DEPS, previewEdit, SIMULATED_EDIT_DEPS } from "@/lib/trip/trip-edit";

/**
 * A refused edit answers 400 with the English `error` older clients read and the same refusal as
 * a `notice` to show in either language. An error that is not a notice is passed on raw. A request
 * in data mode `mock` routes its legs and looks up its places from fixtures, never from Google.
 */
export async function POST(request: Request) {
  try {
    const simulated = parseDataMode(request.headers.get("x-trip-data-mode")) === "mock";
    return Response.json(
      await previewEdit(await request.json(), simulated ? SIMULATED_EDIT_DEPS : LIVE_EDIT_DEPS),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const notice = errorNotice(error, { key: "Preview failed. Try the change again." });
    return Response.json(noticeBody(notice), { status: 400 });
  }
}
