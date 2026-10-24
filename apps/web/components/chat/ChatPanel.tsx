"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type AgentProgressEvent, type AssistantId, type TripPlan } from "@trip/shared";
import { quickPrompts } from "@/lib/planning/quick-prompts";
import { translate } from "@/lib/i18n/locale";
import type { Message } from "@/lib/workspace";
import { ThinkingProcess } from "./ThinkingProcess";
import { Composer } from "./Composer";
import { MessageItem } from "./MessageItem";
import { QuestionComposer } from "./QuestionComposer";
import { TrajectoryTab, type TurnJump } from "../trajectory/TrajectoryTab";
import { messageTurns } from "@/lib/trajectory/adapter";
import { useTrajectoryFocus } from "./trajectory-focus";
import type { PendingAsk, QuestionAnswer, QuestionProgress } from "@/lib/workspace/ask-user";
import type { PreparedAttachment } from "@/lib/chat/attachments";
import type { Notice } from "@/lib/i18n/notice";
import { useLocale } from "../account/LocaleProvider";

export function ChatPanel({
  plan,
  messages,
  input,
  onInput,
  busy,
  locked = false,
  activity,
  onSend,
  onEdit,
  onStart,
  phone = false,
  onCancel,
  error,
  onAttachFiles,
  attachments,
  onRemoveAttachment,
  canAttach,
  attachNotices,
  ask,
  onAnswer,
  onAskProgress,
  onDismissAsk,
}: {
  plan?: TripPlan;
  messages: Message[];
  input: string;
  onInput: (value: string) => void;
  busy: boolean;

  locked?: boolean;
  activity: AgentProgressEvent[];

  onSend: (message?: string) => void;
  onEdit: () => void;

  onStart?: () => void;

  phone?: boolean;

  onCancel?: () => void;

  error?: Notice;

  onAttachFiles?: (files: File[]) => void;

  attachments?: PreparedAttachment[];

  onRemoveAttachment?: (id: string) => void;

  canAttach?: boolean;

  attachNotices?: readonly Notice[];

  ask?: PendingAsk;

  onAnswer?: (answers: QuestionAnswer[]) => void;

  onAskProgress?: (progress: QuestionProgress) => void;

  onDismissAsk?: () => void;
}) {
  const { t, locale } = useLocale();
  const stream = useRef<HTMLDivElement>(null);

  const restored = useRef(messages.length);
  const last = messages.length - 1;
  const revealIndex = last >= restored.current && messages[last]?.role === "agent" ? last : -1;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (messages.length || activity.length)
      stream.current?.scrollTo({ top: stream.current.scrollHeight });
  }, [messages, activity]);

  const empty = !plan && !messages.length;
  const [more, setMore] = useState(false);
  useEffect(() => {
    const node = stream.current;
    if (!empty || !node) return setMore(false);
    const update = () => {
      const padding = parseFloat(getComputedStyle(node).paddingBottom) || 0;
      setMore(node.scrollTop + node.clientHeight < node.scrollHeight - padding - 1);
    };
    const observer = new ResizeObserver(update);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    node.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      node.removeEventListener("scroll", update);
    };
  }, [empty]);

  const [view, setView] = useState<"conversation" | "trajectory">("conversation");
  const showTrajectory = view === "trajectory" && !phone;
  const savedScroll = useRef<number | null>(null);
  const choose = (next: "conversation" | "trajectory") => {
    if (next === view) return;
    if (next === "trajectory") savedScroll.current = stream.current?.scrollTop ?? 0;
    setView(next);
  };
  const { focus } = useTrajectoryFocus();
  const [only, setOnly] = useState<AssistantId | undefined>();
  const [jump, setJump] = useState<TurnJump | undefined>();
  const turns = useMemo(() => messageTurns(messages), [messages]);
  const handled = useRef(focus?.nonce ?? 0);
  useEffect(() => {
    if (!focus || focus.nonce === handled.current || phone) return;
    handled.current = focus.nonce;
    setOnly(focus.assistant);
    setJump(focus.turn === undefined ? undefined : { turn: focus.turn, nonce: focus.nonce });
    choose("trajectory");
  });
  useLayoutEffect(() => {
    if (view !== "conversation" || savedScroll.current === null) return;
    stream.current?.scrollTo({ top: savedScroll.current, behavior: "instant" });
    savedScroll.current = null;
  }, [view]);

  const prompts = useMemo(() => quickPrompts(), []);
  return (
    <section className="panel chat" aria-label={t("Chat")}>
      {!phone && (
        <div className="chat__tabs" role="tablist" aria-label={t("Chat view")}>
          {(["conversation", "trajectory"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`chat-tab-${id}`}
              aria-controls={`chat-panel-${id}`}
              aria-selected={view === id}
              tabIndex={view === id ? 0 : -1}
              onClick={() => choose(id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                const next = id === "conversation" ? "trajectory" : "conversation";
                choose(next);
                document.getElementById(`chat-tab-${next}`)?.focus();
              }}
            >
              {t(id === "conversation" ? "Conversation" : "Trajectory")}
            </button>
          ))}
        </div>
      )}
      <div
        className="chat__stream"
        id="chat-panel-conversation"
        ref={stream}
        hidden={showTrajectory}
        {...(phone ? {} : { role: "tabpanel", "aria-labelledby": "chat-tab-conversation" })}
        aria-busy={busy}
        data-more={more ? "true" : undefined}
      >
        {empty && (
          <div className="chat-empty">
            <h3>{t("Where to next?")}</h3>
            <p>
              {phone && onStart
                ? t(
                    "Describe your destination, travel dates, number of travellers and total budget, or tap Add trip details below.",
                  )
                : t(
                    "Describe your destination, travel dates, number of travellers and total budget, or add them in the bar at the top.",
                  )}
            </p>
            <div className="chat-empty__suggestions" aria-label={t("Example trips")}>
              {prompts.map(({ label, text, params }) => (
                <button
                  key={t(label)}
                  type="button"
                  title={t(label)}
                  disabled={busy || locked}
                  onClick={() => onSend(translate(locale, text, params))}
                >
                  {t(label)}
                </button>
              ))}
            </div>
            <p className="chat-empty__input-hint">
              {t("Pick an example to plan it now, or write your own below.")}
            </p>
            {onStart && (
              <button type="button" onClick={onStart}>
                {t("Add trip details")}
              </button>
            )}
          </div>
        )}
        <div role="log" aria-live="polite">
          {messages.map((m, i) => (
            <MessageItem
              key={i}
              message={m}
              turn={turns[i] ?? undefined}
              animate={i === revealIndex}
            />
          ))}
        </div>
        {(activity.length > 0 || busy) && (
          <section
            className={`agent-activity${error && !busy ? " agent-activity--error" : ""}`}
            aria-label={t("Thinking process")}
          >
            <ThinkingProcess activity={activity} busy={busy} error={error} />
          </section>
        )}
      </div>
      {showTrajectory && (
        <div
          className="chat__trajectory"
          id="chat-panel-trajectory"
          role="tabpanel"
          aria-labelledby="chat-tab-trajectory"
        >
          <TrajectoryTab
            messages={messages}
            live={activity}
            busy={busy}
            only={only}
            onClear={() => setOnly(undefined)}
            {...(jump ? { jump, onJumped: () => setJump(undefined) } : {})}
          />
        </div>
      )}
      {ask && onAnswer && onDismissAsk ? (
        <QuestionComposer
          key={ask.key}
          request={ask}
          onSubmit={onAnswer}
          onCancel={onDismissAsk}
          onProgress={onAskProgress}
          submitting={busy}
          {...(onCancel ? { onStop: onCancel } : {})}
        />
      ) : (
        <form
          className="chat__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!locked) onSend();
          }}
        >
          <Composer
            value={input}
            placeholder={t(
              plan ? "Tell me what to change…" : "Destination, dates, travellers and budget…",
            )}
            busy={busy}
            canSend={!locked && (Boolean(input.trim()) || Boolean(attachments?.length))}
            canCancel={Boolean(onCancel)}
            inputRef={inputRef}
            onInput={onInput}
            onSend={onSend}
            {...(onCancel ? { onCancel } : {})}
            {...(onAttachFiles ? { onAttachFiles } : {})}
            {...(attachments ? { attachments } : {})}
            {...(onRemoveAttachment ? { onRemoveAttachment } : {})}
            {...(canAttach === undefined ? {} : { canAttach })}
            {...(attachNotices ? { attachNotices } : {})}
          />
        </form>
      )}
      <p className="disclaimer">
        {t("Estimates require verification. Nothing here makes a booking.")}
      </p>
    </section>
  );
}
