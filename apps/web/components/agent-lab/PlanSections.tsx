import type { AgentLabCompletedRunArtifact } from "@trip/shared";
import { labMoney } from "@/lib/agent-lab/money";

type Plan = AgentLabCompletedRunArtifact["plan"];

export function PlanSummary({ plan }: { plan: Plan }) {
  return (
    <div className="agent-lab__plan-summary">
      <div>
        <span>Destination</span>
        <strong>{plan.brief.destination}</strong>
      </div>
      <div>
        <span>Budget</span>
        <strong>{labMoney.money(plan.budgetTotal)}</strong>
      </div>
      <div>
        <span>Estimated</span>
        <strong>{labMoney.money(plan.estTotal)}</strong>
      </div>
    </div>
  );
}

export function PlanSections({ plan }: { plan: Plan }) {
  return (
    <div className="agent-lab__sections">
      {plan.sections.map((section) => (
        <article key={section.id} data-agent-lab-section>
          <div>
            <span>{section.label}</span>
            <strong>{section.summary}</strong>
          </div>
          <b>{labMoney.money(section.estCost)}</b>
        </article>
      ))}
    </div>
  );
}
