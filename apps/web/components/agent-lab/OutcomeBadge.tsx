import type { FaultOutcome } from "@/lib/agent-lab/fault-outcome";

/**
 * How a run ended, as a word. The Run, Compare and Failures views all use this one badge, so a run reads the
 * same wherever it appears; the border colour only reinforces the word.
 */
export function OutcomeBadge({ outcome }: { outcome: FaultOutcome }) {
  return (
    <p className="agent-lab__outcome" data-agent-lab-outcome data-outcome={outcome.kind}>
      {outcome.label}
    </p>
  );
}
