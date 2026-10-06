import { errorNotice, noticeBody } from "@/lib/i18n/notice";
import { previewEdit } from "@/lib/trip/trip-edit";

/**
 * A refused edit answers 400 with the English `error` older clients read and the same refusal as
 * a `notice` to show in either language. An error that is not a notice is passed on raw.
 */
export async function POST(request: Request) {
  try {
    return Response.json(await previewEdit(await request.json()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const notice = errorNotice(error, { key: "Preview failed. Try the change again." });
    return Response.json(noticeBody(notice), { status: 400 });
  }
}
