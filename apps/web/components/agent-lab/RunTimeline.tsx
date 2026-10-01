import type { AgentLabRunEvent } from "@trip/shared";
import { eventCopy, eventKindLabel } from "@/lib/agent-lab/event-copy";

/** The ordered trace of one run, with each event labelled by the part of the system that produced it. */
export function RunTimeline({
  events,
  label,
}: {
  events: readonly AgentLabRunEvent[];
  label: string;
}) {
  return (
    <ol className="agent-lab__timeline" aria-label={label}>
      {events.map((runEvent) => {
        const copy = eventCopy(runEvent);
        return (
          <li
            key={`${runEvent.runId}-${runEvent.sequence}`}
            data-agent-lab-event
            data-event-kind={copy.kind}
          >
            <span className="agent-lab__sequence">{runEvent.sequence}</span>
            <div>
              <span className="agent-lab__kind" data-kind={copy.kind}>
                {eventKindLabel[copy.kind]}
              </span>
              <strong>{copy.title}</strong>
              <p>{copy.detail}</p>
              {copy.constraints ? (
                <div className="agent-lab__list">
                  <span>Constraints</span>
                  <ul className="agent-lab__constraints" aria-label="Constraints">
                    {copy.constraints.map((constraint) => (
                      <li key={constraint}>{constraint}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {copy.list ? (
                <div className="agent-lab__list">
                  <span>{copy.list.heading}</span>
                  <ul className="agent-lab__constraints" aria-label={copy.list.heading}>
                    {copy.list.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <small>+{runEvent.elapsedMs} ms</small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
