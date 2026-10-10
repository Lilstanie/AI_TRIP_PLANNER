const flow = [
  {
    owner: "LangGraph node",
    step: "Dispatch",
    detail:
      "Hands each specialist one bounded objective, in the order the planning board allows: a stay needs the flights, and the day plan needs the stay.",
  },
  {
    owner: "LangGraph node",
    step: "Detect conflicts",
    detail:
      "Sums the budget and checks times and geography. Deterministic: the same plan always gives the same answer.",
  },
  {
    owner: "LangGraph edge",
    step: "Revise, or stop",
    detail:
      "Routes a conflict only to the specialists it names, keeps the best plan so far, and stops at the round limit, when the budget cannot be met or when a revision does not improve the plan.",
  },
  {
    owner: "LangGraph node",
    step: "Assemble",
    detail: "Validates every proposal and the final plan against the shared contract.",
  },
] as const;

const capabilities = [
  {
    id: "itinerary",
    name: "Itinerary",
    goal: "Order the days and the stops.",
    tools: "Place search and routes.",
    output: "Timed activities with locations.",
    failure: "Repeats or generic stops; days in the wrong city.",
  },
  {
    id: "transport",
    name: "Transport",
    goal: "Get the travellers there and between cities.",
    tools: "Flight and route search.",
    output: "Priced flights and hops, with their dates.",
    failure: "A provider is down, so the section is unavailable and unpriced.",
  },
  {
    id: "accommodation",
    name: "Accommodation",
    goal: "Choose where to stay, city by city.",
    tools: "Stay search.",
    output: "Stays with check-in and check-out dates.",
    failure: "No stay found: it stops instead of inventing one.",
  },
  {
    id: "destination-guide",
    name: "Destination guide",
    goal: "Say what a traveller needs to know before going.",
    tools: "Places and weather.",
    output: "Customs, safety, entry and packing notes.",
    failure: "A provider fails, so guidance falls back to fixed advice.",
  },
  {
    id: "dining",
    name: "Dining",
    goal: "Fit meals to the diet and the day's last stop.",
    tools: "Place search.",
    output: "A meal budget and candidates.",
    failure: "A provider fails, so the section falls back to an estimate.",
  },
] as const;

const outcomes = [
  ["Completed", "The run finished. Any conflicts it left are listed, never hidden."],
  ["Degraded", "It carried on with less: a section is unavailable, or the supervisor fell back."],
  ["Partial result", "A revision did not improve the plan, so the best known plan was kept."],
  ["Failed", "A specialist could not finish, so no plan was assembled and the trace was kept."],
] as const;

export function ArchitectureView() {
  return (
    <section
      className="agent-lab__architecture"
      aria-labelledby="agent-lab-architecture-title"
      data-agent-lab-architecture
    >
      <div className="agent-lab__panel-heading">
        <div>
          <p className="agent-lab__kicker">Architecture</p>
          <h2 id="agent-lab-architecture-title">How the planner is built, and why</h2>
        </div>
      </div>

      <section data-agent-lab-arch="ownership" aria-labelledby="arch-ownership">
        <h3 id="arch-ownership">Who owns what</h3>
        <p>
          LangGraph owns the workflow state, the order specialists are dispatched in, conflict
          detection, revision routing, scoring and when to stop. LangChain agents are bounded
          reasoners and tool users inside that workflow. Each gets one objective, its own typed
          tools and a schema its output must pass. A model never decides when the graph stops, and
          never changes a budget rule.
        </p>
        <ol className="agent-lab__flow" aria-label="The planning workflow">
          {flow.map((item) => (
            <li key={item.step}>
              <span>{item.owner}</span>
              <strong>{item.step}</strong>
              <p>{item.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section data-agent-lab-arch="capabilities" aria-labelledby="arch-capabilities">
        <h3 id="arch-capabilities">Five capability boundaries</h3>
        <p>
          Each capability has a goal, its own tools, an output the others do not produce and its own
          way of failing. That is what makes a failure local and a revision targeted: only the
          specialist a conflict names runs again.
        </p>
        <ul className="agent-lab__capabilities">
          {capabilities.map((item) => (
            <li key={item.id} data-agent-lab-capability={item.id}>
              <h4>{item.name}</h4>
              <dl>
                <div>
                  <dt>Goal</dt>
                  <dd>{item.goal}</dd>
                </div>
                <div>
                  <dt>Tools</dt>
                  <dd>{item.tools}</dd>
                </div>
                <div>
                  <dt>Output</dt>
                  <dd>{item.output}</dd>
                </div>
                <div>
                  <dt>Fails by</dt>
                  <dd>{item.failure}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <section data-agent-lab-arch="deterministic" aria-labelledby="arch-deterministic">
        <h3 id="arch-deterministic">What is not an agent</h3>
        <p>
          Budgeting, conflict detection, state transitions, maps and weather are graph nodes or
          typed tools, not agents. They exercise no judgement and must answer the same way every
          time, so a model deciding them would only add ways to fail. The evaluator is deterministic
          too: every figure is recomputed from the plan and the trace, with no model judging
          another.
        </p>
      </section>

      <section data-agent-lab-arch="five" aria-labelledby="arch-five">
        <h3 id="arch-five">Why five, and not a fixed number</h3>
        <p>
          Five is the smallest split that holds today, not a fixed number. Two capabilities that
          stop needing their own tools or failure handling should merge. A sixth specialist, or any
          new capability, earns a place only by showing its own tools, its own output and its own
          failure mode that the others do not have, and a revision that only it can make.
        </p>
      </section>

      <section data-agent-lab-arch="measures" aria-labelledby="arch-measures">
        <h3 id="arch-measures">How to read the results</h3>
        <p>
          The single agent against five specialists with no revision measures specialization. Five
          specialists with no revision against targeted revision measures what the revision loop
          adds. The page never ranks the strategies, and it does not claim to measure how well a
          model plans.
        </p>
        <p>
          Fixture data runs deterministic fixtures, so each result repeats exactly, needs no key and
          never reaches a provider or a model. Live data exists only where the deployment enables
          it. Every result says which it is. Token usage is shown only when the provider reported it
          for every call; otherwise it reads Unavailable, never zero, and cost is not reported.
        </p>
        <dl className="agent-lab__outcomes" aria-label="Outcome words">
          {outcomes.map(([word, meaning]) => (
            <div key={word}>
              <dt>{word}</dt>
              <dd>{meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
    </section>
  );
}
