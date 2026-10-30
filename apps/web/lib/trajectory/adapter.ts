import type { AgentProgressEvent, AssistantId } from "@trip/shared";
import { checkText } from "@/components/chat/team-check";
import type { TrajectoryTurnModel, TrajectoryTurnResult } from "@/components/trajectory/layout";
import type { TrajectoryTranslate } from "@/components/trajectory/locales";
import type { TrajectoryStep } from "@/components/trajectory/trajectory-table-records";
import type { TrajectoryCellProps } from "@/components/trajectory/trajectory-record";
import type { Message } from "@/lib/workspace";
import { PREPARING_SUMMARY } from "@/lib/workspace/session";

type Translate = Parameters<typeof checkText>[0];
type DisplayName = Parameters<typeof checkText>[1];
type Draft = Omit<TrajectoryCellProps, "index">;

interface Block {
  round: number;
  head: Draft;
  children: Draft[];
}

interface Section {
  user: Message | undefined;
  reply: Message | undefined;
  events: readonly AgentProgressEvent[];
  settled: boolean;
}

export interface TrajectoryInput {
  messages: readonly Message[];
  live: readonly AgentProgressEvent[];
  busy: boolean;
  t: Translate;
  displayName: DisplayName;
  tt: TrajectoryTranslate;
  only?: AssistantId | undefined;
}

export interface TrajectoryLedger {
  turns: TrajectoryTurnModel[];
  steps: TrajectoryStep[];
}

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

function sections(input: TrajectoryInput): Section[] {
  const out: Section[] = [];
  for (const message of input.messages) {
    const current = out.at(-1);
    if (message.role === "user") {
      out.push({ user: message, reply: undefined, events: [], settled: true });
    } else if (current !== undefined && current.reply === undefined) {
      current.reply = message;
      current.events = message.activity ?? [];
    } else {
      out.push({ user: undefined, reply: message, events: message.activity ?? [], settled: true });
    }
  }
  const last = out.at(-1);
  if (last?.user !== undefined && last.reply === undefined && input.live.length > 0) {
    last.events = input.live;
    last.settled = !input.busy;
  }
  return out;
}

function markdown(summary: string, constraints: readonly string[] | undefined): string {
  return constraints === undefined || constraints.length === 0
    ? summary
    : `${summary}\n\n${constraints.map((line) => `- ${line}`).join("\n")}`;
}

function checkOwners(decision: Parameters<typeof checkText>[2]): AssistantId[] {
  if (decision.type === "conflicts_detected") return decision.conflicts.map((item) => item.agent);
  if (decision.type === "revision_scored") return [...decision.agents];
  return [];
}

function checkDetail(
  decision: Extract<AgentProgressEvent, { type: "decision" }>["decision"],
  displayName: DisplayName,
): string | undefined {
  if (decision.type !== "conflicts_detected" || decision.conflicts.length === 0) return undefined;
  return decision.conflicts
    .map((conflict) => `${displayName(conflict.agent)}: ${conflict.reason}`)
    .join("\n");
}

function blocks(
  events: readonly AgentProgressEvent[],
  prefix: string,
  settled: boolean,
  input: TrajectoryInput,
): Block[] {
  const { t, displayName } = input;
  const out: Block[] = [];
  const open = new Map<string, Block>();
  const calls = new Map<string, Draft>();
  const filtered = events.filter(
    (event) => !(event.type === "coordinator" && event.summary === PREPARING_SUMMARY),
  );
  for (const [position, event] of filtered.entries()) {
    const recordId = `${prefix}:e${position}`;
    if (event.type === "coordinator") {
      const body = markdown(event.summary, event.constraints);
      out.push({
        round: event.round,
        head: {
          recordId,
          assistants: ["coordinator"],
          kind: "message",
          text: displayName("coordinator"),
          previewMarkdown: oneLine(event.summary),
          outputDetail: body,
        },
        children: [],
      });
    } else if (event.type === "agent_started") {
      const objective = event.objective === undefined ? undefined : oneLine(event.objective);
      const name = displayName(event.agent);
      const block: Block = {
        round: event.round,
        head: {
          recordId,
          assistants: [event.agent],
          kind: "tool",
          text: objective ? `${name} · ${objective}` : name,
          toolName: event.agent,
          running: true,
          ...(event.objective === undefined ? {} : { inputDetail: event.objective }),
        },
        children: [],
      };
      open.set(`${event.agent}:${event.round}`, block);
      out.push(block);
    } else if (event.type === "agent_completed" || event.type === "agent_failed") {
      const head = open.get(`${event.agent}:${event.round}`)?.head;
      if (head === undefined) continue;
      const failed = event.type === "agent_failed";
      const result =
        event.type === "agent_failed" ? event.error : (event.outcome ?? event.summary ?? t("Done"));
      head.running = false;
      head.outputDetail = result;
      head.result = oneLine(result);
      if (failed) head.isError = true;
    } else if (event.type === "tool_started") {
      const draft: Draft = {
        recordId,
        assistants: [event.agent],
        kind: "subtool",
        text: event.label,
        toolName: event.tool,
        callId: event.callId,
        running: true,
        inputDetail:
          event.args === undefined || Object.keys(event.args).length === 0
            ? event.summary
            : JSON.stringify(event.args, null, 2),
      };
      calls.set(event.callId, draft);
      const parent = open.get(`${event.agent}:${event.round}`);
      if (parent === undefined) out.push({ round: event.round, head: draft, children: [] });
      else parent.children.push(draft);
    } else if (event.type === "tool_completed") {
      const draft = calls.get(event.callId);
      if (draft === undefined) continue;
      const rows =
        event.resultRows === undefined || event.resultRows.length === 0
          ? ""
          : `\n\n${JSON.stringify(event.resultRows, null, 2)}`;
      draft.running = false;
      draft.outputDetail = `${event.resultSummary}${rows}`;
      draft.result = oneLine(event.resultSummary);
    } else if (event.type === "tool_failed") {
      const draft = calls.get(event.callId);
      if (draft === undefined) continue;
      draft.running = false;
      draft.isError = true;
      draft.outputDetail = event.error;
      draft.result = oneLine(event.error);
    } else if (event.type === "decision") {
      const { decision } = event;
      if (
        decision.type === "conflicts_detected" ||
        decision.type === "revision_scored" ||
        decision.type === "loop_stopped"
      ) {
        out.push({
          round: event.round,
          head: {
            recordId,
            assistants: checkOwners(decision),
            kind: "tool",
            text: checkText(t, displayName, decision),
            inputDetail: JSON.stringify(decision, null, 2),
            outputDetail: checkDetail(decision, displayName),
          },
          children: [],
        });
      }
    }
  }
  if (settled) {
    const stopped = t("Stopped");
    for (const block of out) {
      for (const draft of [block.head, ...block.children]) {
        if (!draft.running) continue;
        draft.running = false;
        draft.isError = true;
        draft.outputDetail = stopped;
        draft.result = stopped;
      }
    }
  }
  return out;
}

function openChecks(events: readonly AgentProgressEvent[]): boolean {
  let open = false;
  for (const event of events) {
    if (event.type !== "decision") continue;
    const { decision } = event;
    if (decision.type === "conflicts_detected") open = decision.conflicts.length > 0;
    else if (decision.type === "loop_stopped")
      open = decision.reason === "round_limit" || decision.reason === "infeasible_budget";
  }
  return open;
}

function turnResult(
  section: Section,
  drafts: readonly Draft[],
  working: boolean,
): TrajectoryTurnResult {
  if (working) return "working";
  if (section.reply === undefined || drafts.some((draft) => draft.isError)) return "failed";
  if (drafts.some((draft) => draft.running)) return "working";
  return openChecks(section.events) ? "needs_change" : "done";
}

function stepStatus(cells: readonly Draft[]): TrajectoryStep["status"] {
  if (cells.some((cell) => cell.isError)) return "error";
  return cells.some((cell) => cell.running) ? "running" : "complete";
}

export function messageTurns(messages: readonly Message[]): (number | null)[] {
  const out: (number | null)[] = [];
  let turn = 0;
  let awaitingReply = false;
  for (const message of messages) {
    if (message.role === "user") {
      turn += 1;
      awaitingReply = true;
      out.push(turn);
    } else if (awaitingReply) {
      awaitingReply = false;
      out.push(turn);
    } else {
      out.push(null);
    }
  }
  return out;
}

/**
 * Map stored messages and live progress events to the Trajectory ledger.
 * @param input - Messages in order, the live events of an unfinished request, and the translators.
 * @returns One turn per traveller message and one step per workflow round, with no timestamps.
 */
export function buildTrajectory(input: TrajectoryInput): TrajectoryLedger {
  const turns: TrajectoryTurnModel[] = [];
  const steps: TrajectoryStep[] = [];
  let turnNumber = 0;
  let index = 0;
  const finish = (draft: Draft): TrajectoryCellProps => ({ ...draft, index: index++ });
  const all = sections(input);
  for (const [sectionIndex, section] of all.entries()) {
    const turn = section.user === undefined ? null : ++turnNumber;
    const prefix = turn === null ? `m${sectionIndex}` : `t${turn}`;
    const rounds = new Map<number, Draft[]>();
    const owned = (draft: Draft) =>
      input.only === undefined || draft.assistants?.includes(input.only) === true;
    const built = blocks(section.events, prefix, section.settled, input);
    const working = section.reply === undefined && input.busy && sectionIndex === all.length - 1;
    for (const block of built) {
      const kept = [block.head, ...block.children].filter(owned);
      if (kept.length === 0) continue;
      const cells = rounds.get(block.round) ?? [];
      cells.push(...kept);
      rounds.set(block.round, cells);
    }
    const lead: Draft[] = [];
    if (section.user !== undefined && input.only === undefined) {
      lead.push({
        recordId: `${prefix}:user`,
        kind: "user",
        text: oneLine(section.user.text),
        inputDetail: section.user.text,
      });
    }
    if (section.reply !== undefined) {
      const reply: Draft = {
        recordId: `${prefix}:reply`,
        assistants: [section.reply.assistant ?? "coordinator"],
        kind: "message",
        text: input.displayName(section.reply.assistant ?? "coordinator"),
        previewMarkdown: oneLine(section.reply.text),
        outputDetail: section.reply.text,
      };
      const lastRound = [...rounds.keys()].sort((left, right) => left - right).at(-1);
      if (owned(reply)) {
        if (lastRound === undefined) lead.push(reply);
        else rounds.get(lastRound)?.push(reply);
      }
    }
    const groups: TrajectoryTurnModel["groups"][number][] = [];
    if (lead.length > 0) {
      groups.push({ title: input.tt("group.message"), cells: lead.map(finish) });
    }
    for (const round of [...rounds.keys()].sort((left, right) => left - right)) {
      const drafts = rounds.get(round) ?? [];
      const title = input.tt("step.label", { step: round });
      groups.push({ title, round, cells: drafts.map(finish) });
      if (turn !== null)
        steps.push({ turn, step: round, group: title, status: stepStatus(drafts) });
    }
    if (groups.length > 0 || input.only === undefined) {
      turns.push({
        turn,
        ...(section.user === undefined ? {} : { summary: oneLine(section.user.text) }),
        result: turnResult(
          section,
          built.flatMap((block) => [block.head, ...block.children]),
          working,
        ),
        groups,
      });
    }
  }
  return { turns, steps };
}
