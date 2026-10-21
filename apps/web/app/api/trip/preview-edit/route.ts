import { errorNotice, noticeBody } from "@/lib/i18n/notice";
import { mapProviderFor, mockUsesProvider } from "@/lib/map-provider";
import { requestDataMode } from "@/lib/auth/live-data";
import { liveEditDeps, previewEdit, SIMULATED_EDIT_DEPS } from "@/lib/trip/trip-edit";

export async function POST(request: Request) {
  try {
    const dataMode = await requestDataMode(request);
    const deps =
      dataMode === "mock" && !mockUsesProvider()
        ? SIMULATED_EDIT_DEPS
        : liveEditDeps(() => mapProviderFor(dataMode));
    return Response.json(await previewEdit(await request.json(), deps), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const notice = errorNotice(error, { key: "Preview failed. Try the change again." });
    return Response.json(noticeBody(notice), { status: 400 });
  }
}
