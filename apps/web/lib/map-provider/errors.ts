import { NoticeError } from "@/lib/i18n/notice";
import type { MapProviderId, UnavailableReason } from "./types";

/** A map provider could not answer at all, as opposed to answering "not found". */
export class MapProviderUnavailableError extends NoticeError {
  constructor(
    readonly provider: MapProviderId,
    readonly reason: UnavailableReason,
  ) {
    super({ key: "The map service is temporarily unavailable. Please retry." });
    this.name = "MapProviderUnavailableError";
  }
}
