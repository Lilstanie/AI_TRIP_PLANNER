/** Static explanations the lab owes the visitor: what is measured, what fixture mode is, and why the
 * deterministic parts of the planner are not agents. */
export function DesignNotes() {
  return (
    <section className="agent-lab__notes" aria-labelledby="agent-lab-notes-title">
      <h2 id="agent-lab-notes-title">How to read this</h2>
      <div>
        <h3>What fixture mode shows</h3>
        <p>
          All three strategies run deterministic fixtures, so each result repeats exactly and needs
          no key. The single-agent baseline replays a scripted plan after loading its evidence once;
          the five specialists run for real against mock providers. The comparison shows how
          evidence is collected and measured, not how well a model plans, and latency here is
          orchestration overhead, not model time.
        </p>
      </div>
      <div>
        <h3>Why these five, and not a fixed number</h3>
        <p>
          Itinerary, transport, accommodation, destination guidance and dining each own a goal,
          their own tools and an output the others do not produce. Budgeting, conflict checks, state
          transitions, maps and weather are graph nodes or tools instead: they exercise no judgement
          and must answer the same way every time, so a model deciding them would only add ways to
          fail. LangGraph controls the workflow; the specialists reason inside bounded roles. Five
          is the smallest split that holds today, not a target: two capabilities that stop needing
          their own tools or failure handling should merge, and a new one earns a place only by
          showing an output and a failure mode the others do not have.
        </p>
      </div>
    </section>
  );
}
