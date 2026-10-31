"use client";
import { useLocale } from "../account/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/locale";
import type { AgentProposalSource } from "@trip/shared";
import { Badge } from "../ui/badge";

const SOURCE_KIND_LABEL: Record<AgentProposalSource["kind"] | "unknown", MessageKey> = {
  live: "liveData",
  estimated: "estimatedData",
  mock: "mockData",
  fallback: "fallbackPlan",
  unavailable: "dataUnavailable",
  unknown: "sourceNotRecorded",
};

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
