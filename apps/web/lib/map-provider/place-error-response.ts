import { NoticeError, noticeBody, type Notice } from "@/lib/i18n/notice";
import {
  GoogleNotConfiguredError,
  GoogleRequestError,
  placesUnavailable,
} from "@/lib/integrations/google";
import { MapProviderUnavailableError } from "./errors";

/** Details/photos supply their own missing-resource notice; search has no missing resource. */
export function placeErrorResponse(error: unknown, missingResource?: Notice): Response {
  // Provider unavailability also extends NoticeError, but is retryable rather than a 404.
  if (error instanceof MapProviderUnavailableError)
    return Response.json(noticeBody(error.notice), { status: 503 });
  // A missing key is permanent: retries cannot fix the deployment.
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
  // Search historically uses the normalized status; resource routes retain upstream notices.
  return Response.json(noticeBody(placesUnavailable(missingResource ? upstream : status)), {
    status,
  });
}
