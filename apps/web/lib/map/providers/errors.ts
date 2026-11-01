import { NoticeError } from "@/lib/i18n/notice";
import type { MapProviderId, UnavailableReason } from "./types";

export class MapProviderUnavailableError extends NoticeError {
  constructor(
    readonly provider: MapProviderId,
    readonly reason: UnavailableReason,
  ) {
    super({ key: "theMapServiceIsTemporarily" });
    this.name = "MapProviderUnavailableError";
  }
}
