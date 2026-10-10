import { NoticeError, noticeBody, type Notice } from "@/lib/i18n/notice";
import {
  GoogleNotConfiguredError,
  GoogleRequestError,
  placesUnavailable,
} from "@/lib/integrations/google";
import { MapProviderUnavailableError } from "./errors";

export function placeErrorResponse(error: unknown, missingResource?: Notice): Response {
  if (error instanceof MapProviderUnavailableError)
    return Response.json(noticeBody(error.notice), { status: 503 });

  if (error instanceof GoogleNotConfiguredError)
    return Response.json(noticeBody({ key: "Google Places is not set up for this app." }), {
      status: 503,
    });
  if (missingResource && error instanceof NoticeError && !(error instanceof GoogleRequestError))
    return Response.json(noticeBody(error.notice), { status: 404 });
  const upstream = error instanceof GoogleRequestError ? error.status : undefined;
  if (missingResource && (upstream === 400 || upstream === 404))
    return Response.json(noticeBody(missingResource), { status: 404 });
  const status = upstream === 429 ? 429 : 502;

  return Response.json(noticeBody(placesUnavailable(missingResource ? upstream : status)), {
    status,
  });
}
