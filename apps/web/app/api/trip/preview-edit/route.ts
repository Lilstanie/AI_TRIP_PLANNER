import { parseDataMode } from "@trip/tools";
import { errorNotice, noticeBody } from "@/lib/i18n/notice";
import { mapProvider, mockUsesProvider } from "@/lib/map-provider";
import { liveEditDeps, previewEdit, SIMULATED_EDIT_DEPS } from "@/lib/trip/trip-edit";

/**
 * A refused edit answers 400 with the English `error` older clients read and the same refusal as
 * a `notice` to show in either language. An error that is not a notice is passed on raw. A request
 * in data mode `mock` routes its legs and looks up its places from fixtures, never from Google: with
 * Google simulated down the map provider answers from its OSM fixtures; otherwise it does not run.
 */
export async function POST(request: Request) {
  try {
    const mock = parseDataMode(request.headers.get("x-trip-data-mode")) === "mock";
    const deps =
      mock && !mockUsesProvider() ? SIMULATED_EDIT_DEPS : liveEditDeps(() => mapProvider(request));
    return Response.json(await previewEdit(await request.json(), deps), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const notice = errorNotice(error, { key: "Preview failed. Try the change again." });
    return Response.json(noticeBody(notice), { status: 400 });
  }
}
