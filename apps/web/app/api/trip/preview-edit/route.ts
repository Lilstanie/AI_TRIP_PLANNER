import { NoticeError, noticeText, type Notice } from "@/lib/i18n/notice";
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
    const notice: Notice =
      error instanceof NoticeError
        ? error.notice
        : error instanceof Error
          ? { raw: error.message }
          : { key: "Preview failed. Try the change again." };
    return Response.json({ error: noticeText("en", notice), notice }, { status: 400 });
  }
}
