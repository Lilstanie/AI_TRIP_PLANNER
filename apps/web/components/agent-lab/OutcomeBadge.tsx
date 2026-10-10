import type { FaultOutcome } from "@/lib/agent-lab/fault-outcome";

export function OutcomeBadge({ outcome }: { outcome: FaultOutcome }) {
  return (
    <p className="agent-lab__outcome" data-agent-lab-outcome data-outcome={outcome.kind}>
      {outcome.label}
    </p>
  );
}
