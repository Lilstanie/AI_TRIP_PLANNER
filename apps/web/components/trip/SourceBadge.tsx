"use client";
import { useLocale } from "../account/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/locale";
import type { AgentProposalSource } from "@trip/shared";
import { Badge } from "../ui/badge";

const SOURCE_KIND_LABEL: Record<AgentProposalSource["kind"] | "unknown", MessageKey> = {
  live: "Live data",
  estimated: "Estimated data",
  mock: "Mock data",
  fallback: "Fallback plan",
  unavailable: "Data unavailable",
  unknown: "Source not recorded",
};

/** A single source-status visual shared by result cards and section summaries. */
export function SourceBadge({
  source,
  compact = false,
}: {
  source?: AgentProposalSource;
  compact?: boolean;
}) {
  const { t } = useLocale();
  const kind = source?.kind ?? "unknown";
  return (
    <Badge
      variant="outline"
      className={`source-kind source-kind--${kind}${compact ? " source-kind--compact" : ""}`}
      role="status"
    >
      {t(SOURCE_KIND_LABEL[kind])}
    </Badge>
  );
}
