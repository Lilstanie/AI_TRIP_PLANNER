import { parseDataMode } from "@trip/tools";
import { errorNotice, noticeBody } from "@/lib/i18n/notice";
import { mapProvider, mockUsesProvider } from "@/lib/map-provider";
import { liveEditDeps, previewEdit, SIMULATED_EDIT_DEPS } from "@/lib/trip/trip-edit";

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
