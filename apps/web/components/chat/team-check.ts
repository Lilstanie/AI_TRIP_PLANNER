import { formatMoney } from "@trip/shared";
import type { useLocale } from "@/components/account/LocaleProvider";
import type { useAssistantName } from "./assistant-names";
import type { TeamCheck } from "./team-model";

const STOP_KEYS = {
  converged: "Stopped after round {round}: plan converged",
  round_limit: "Stopped after round {round}: round limit reached",
  infeasible_budget: "Stopped after round {round}: budget infeasible",
  no_improvement: "Stopped after round {round}: no improvement",
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
      ? "Revision score, round {round}: {before} → {after}, revision kept"
      : "Revision score, round {round}: {before} → {after}, revision discarded";
    return t(key, {
      round,
      before: Math.round(decision.scoreBefore),
      after: Math.round(decision.scoreAfter),
    });
  }
  if (decision.conflicts.length === 0)
    return t("Conflict check, round {round}: no conflicts", { round });
  return decision.conflicts
    .map((conflict) => {
      const name = displayName(conflict.agent);
      return conflict.targetSaving === undefined
        ? t("Conflict check, round {round}: {name} must change", { round, name })
        : t("Conflict check, round {round}: {name} should save {amount}", {
            round,
            name,
            amount: formatMoney(conflict.targetSaving, "AUD"),
          });
    })
    .join(" · ");
}
