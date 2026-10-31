import { formatMoney } from "@trip/shared";
import type { useLocale } from "@/components/account/LocaleProvider";
import type { useAssistantName } from "./assistant-names";
import type { TeamCheck } from "./team-model";

const STOP_KEYS = {
  converged: "stoppedAfterRoundRoundPlan",
  round_limit: "stoppedAfterRoundRoundRound",
  infeasible_budget: "stoppedAfterRoundRoundBudget",
  no_improvement: "stoppedAfterRoundRoundNo",
} as const;

export function checkText(
  t: ReturnType<typeof useLocale>["t"],
  displayName: ReturnType<typeof useAssistantName>,
  decision: TeamCheck["decision"],
): string {
  const round = decision.round;
  if (decision.type === "loop_stopped") return t(STOP_KEYS[decision.reason], { round });
  if (decision.type === "revision_scored") {
    const key = decision.kept
      ? "revisionScoreRoundRoundBefore"
      : "revisionScoreRoundRoundBeforeAfter";
    return t(key, {
      round,
      before: Math.round(decision.scoreBefore),
      after: Math.round(decision.scoreAfter),
    });
  }
  if (decision.conflicts.length === 0) return t("conflictCheckRoundRoundNo", { round });
  return decision.conflicts
    .map((conflict) => {
      const name = displayName(conflict.agent);
      return conflict.targetSaving === undefined
        ? t("conflictCheckRoundRoundNameMust", { round, name })
        : t("conflictCheckRoundRoundName", {
            round,
            name,
            amount: formatMoney(conflict.targetSaving, "AUD"),
          });
    })
    .join(" · ");
}
