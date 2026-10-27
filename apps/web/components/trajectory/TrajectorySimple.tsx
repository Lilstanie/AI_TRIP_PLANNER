"use client";
import { useEffect, useRef } from "react";
import type { AssistantId } from "@trip/shared";
import { AssistantIcon } from "@/components/chat/assistants";
import { ASSISTANT_ORDER } from "@/components/chat/assistant-names";
import type { TrajectoryGroupModel, TrajectoryTurnModel } from "./layout";
import type { TrajectoryTranslate } from "./locales";
import { IconChevronRightOutlineRegular, StateDot } from "./shim";
import css from "./simple.module.css";

export interface TrajectorySimpleProps {
  t: TrajectoryTranslate;
  turns: readonly TrajectoryTurnModel[];
  displayName: (id: AssistantId) => string;
  selected: number | undefined;
  onSelect: (turn: number | undefined) => void;
  jump?: { readonly turn: number; readonly nonce: number } | undefined;
  onJumped?: (() => void) | undefined;
}

const isAssistant = (id: string): id is AssistantId =>
  (ASSISTANT_ORDER as readonly string[]).includes(id);

function participants(turn: TrajectoryTurnModel): AssistantId[] {
  const seen = new Set<AssistantId>();
  for (const group of turn.groups) {
    for (const cell of group.cells) {
      if (cell.kind === "user") continue;
      for (const id of cell.assistants ?? []) {
        if (isAssistant(id) && id !== "coordinator") seen.add(id);
      }
    }
  }
  return ASSISTANT_ORDER.filter((id) => seen.has(id));
}

function Avatar({ id, name }: { id: AssistantId; name: string }) {
  return (
    <span role="img" aria-label={name} title={name} data-simple-avatar={id} className={css.avatar}>
      <AssistantIcon id={id} />
    </span>
  );
}

function Rounds({
  t,
  groups,
  displayName,
}: {
  t: TrajectoryTranslate;
  groups: readonly TrajectoryGroupModel[];
  displayName: (id: AssistantId) => string;
}) {
  const rounds = groups.filter((group) => group.round !== undefined);
  return (
    <ol className={css.rounds} aria-label={t("simple.rounds")}>
      {rounds.map((group) => (
        <li key={group.round} className={css.round} data-simple-round={group.round}>
          <h4 className={css.roundTitle}>{group.title}</h4>
          <ul className={css.assignments}>
            {group.cells
              .filter((cell) => cell.kind === "tool")
              .map((cell) => {
                const owner = cell.assistants?.find(
                  (id): id is AssistantId => isAssistant(id) && id !== "coordinator",
                );
                const state = cell.isError ? "error" : cell.running ? "ongoing" : "done";
                return (
                  <li
                    key={cell.index}
                    className={css.assignment}
                    data-simple-assignment={cell.toolName ?? "check"}
                    data-state={state}
                  >
                    {owner === undefined ? (
                      <StateDot state={state} />
                    ) : (
                      <Avatar id={owner} name={displayName(owner)} />
                    )}
                    <span className={css.assignmentText}>
                      <span>{cell.text}</span>
                      {cell.result !== undefined && (
                        <span className={css.assignmentResult}>{cell.result}</span>
                      )}
                    </span>
                  </li>
                );
              })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function TrajectorySimple({
  t,
  turns,
  displayName,
  selected,
  onSelect,
  jump,
  onJumped,
}: TrajectorySimpleProps) {
  const root = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (jump === undefined) return;
    onSelect(jump.turn);
    root.current
      ?.querySelector(`[data-simple-turn="${jump.turn}"]`)
      ?.scrollIntoView({ block: "nearest" });
    onJumped?.();
  }, [jump, onSelect, onJumped]);
  return (
    <ul className={css.list} ref={root} aria-label={t("simple.list")} data-trajectory-simple>
      {turns.map((turn, position) => {
        const open = turn.turn !== null && selected === turn.turn;
        const people = participants(turn);
        const result = turn.result ?? "done";
        return (
          <li
            key={turn.turn ?? `between-${position}`}
            className={css.row}
            data-simple-turn={turn.turn ?? undefined}
            data-turn-result={result}
          >
            <button
              type="button"
              className={css.toggle}
              data-simple-toggle
              aria-expanded={open}
              disabled={turn.turn === null}
              onClick={() => onSelect(open ? undefined : (turn.turn ?? undefined))}
            >
              <IconChevronRightOutlineRegular className={css.chevron} />
              <span className={css.summary} data-simple-summary>
                {turn.summary ?? t("simple.noMessage")}
              </span>
              <span className={css.avatars}>
                {people.map((person) => (
                  <Avatar key={person} id={person} name={displayName(person)} />
                ))}
              </span>
              <span className={css.result} data-simple-result data-tone={result}>
                {t(`simple.result.${result}`)}
              </span>
            </button>
            {open && <Rounds t={t} groups={turn.groups} displayName={displayName} />}
          </li>
        );
      })}
    </ul>
  );
}
