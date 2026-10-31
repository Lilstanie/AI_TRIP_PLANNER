"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { type AgentProgressEvent, type AssistantId, type TripPlan } from "@trip/shared";
import { quickPrompts } from "@/lib/planning/quick-prompts";
import { translate } from "@/lib/i18n/locale";
import { blankDraft, type Message, type Draft } from "@/lib/workspace";
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
import { ChatViewTabs, type ChatView } from "./ChatViewTabs";
import { composerPlaceholders, PLACEHOLDER_ROTATE_MS } from "@/lib/chat/composer-placeholders";

export function ChatPanel({
  plan,
  draft,
  messages,
  input,
  onInput,
  busy,
  locked = false,
  activity,
  onSend,
  onResend,
  onOpenTrip,
  onOpenDay,
  onEdit,
  phone = false,
  showTabs = true,
  blankUntouched = false,
  facts,
  conversationId,
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
  view: viewProp,
  onViewChange,
}: {
  plan?: TripPlan;
  draft?: Draft;
  messages: Message[];
  input: string;
  onInput: (value: string) => void;
  busy: boolean;

  locked?: boolean;
  activity: AgentProgressEvent[];

  onSend: (message?: string) => void;

  onResend?: (index: number, text: string) => boolean;
  onOpenTrip?: () => void;
  onOpenDay?: (day: number) => void;
  onEdit: () => void;

  phone?: boolean;

  showTabs?: boolean;

  blankUntouched?: boolean;

  facts?: ReactNode;
  conversationId?: string | undefined;

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

  view?: ChatView;

  onViewChange?: (view: ChatView) => void;
}) {
  const { t, locale } = useLocale();
  const stream = useRef<HTMLDivElement>(null);

  const restored = useRef(messages.length);
  const last = messages.length - 1;
  const revealIndex = last >= restored.current && messages[last]?.role === "agent" ? last : -1;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const heroTop = useRef<number | null>(null);
  const hero = !phone && !plan && !busy && messages.length === 0;
  useEffect(() => {
    if (messages.length || activity.length)
      stream.current?.scrollTo({ top: stream.current.scrollHeight });
  }, [messages, activity]);

  const [viewState, setViewState] = useState<ChatView>("conversation");
  const view = viewProp ?? viewState;
  const setView = (next: ChatView) => {
    onViewChange?.(next);
    if (viewProp === undefined) setViewState(next);
  };
  const showTrajectory = view === "trajectory" && !phone;
  const savedScroll = useRef<{
    top: number;
    messages: Message[];
    activity: AgentProgressEvent[];
  } | null>(null);
  const lastTop = useRef<number | null>(null);
  const choose = (next: ChatView) => {
    if (next === view) return;
    setView(next);
  };
  const { focus, claim } = useTrajectoryFocus();
  const [only, setOnly] = useState<AssistantId | undefined>();
  const [jump, setJump] = useState<TurnJump | undefined>();
  const turns = useMemo(() => messageTurns(messages), [messages]);
  const lastPlanned = messages.map((message) => message.outcome).lastIndexOf("planned");
  useEffect(() => {
    if (!focus || !claim(focus.nonce)) return;
    if (phone) return;
    setOnly(focus.assistant);
    setJump(focus.turn === undefined ? undefined : { turn: focus.turn, nonce: focus.nonce });
    choose("trajectory");
  });
  useLayoutEffect(() => {
    if (view === "trajectory") {
      if (savedScroll.current === null && lastTop.current !== null)
        savedScroll.current = { top: lastTop.current, messages, activity };
      return;
    }
    const saved = savedScroll.current;
    if (view !== "conversation" || saved === null) return;
    const node = stream.current;
    const arrived = saved.messages !== messages || saved.activity !== activity;
    node?.scrollTo({ top: arrived ? node.scrollHeight : saved.top, behavior: "instant" });
    savedScroll.current = null;
  }, [view, messages, activity]);

  const prompts = useMemo(() => quickPrompts(), []);
  const [focused, setFocused] = useState(false);
  const keys = useMemo(
    () => composerPlaceholders(draft ?? blankDraft(), Boolean(plan)),
    [draft, plan],
  );
  const [placeholderAt, setPlaceholderAt] = useState(0);
  const rotate = focused && !input.trim() && keys.length > 1;
  useEffect(() => {
    setPlaceholderAt(0);
  }, [keys[0], Boolean(plan)]);
  useEffect(() => {
    if (!rotate) return;
    const id = window.setInterval(
      () => setPlaceholderAt((at) => (at + 1) % keys.length),
      PLACEHOLDER_ROTATE_MS,
    );
    return () => window.clearInterval(id);
  }, [rotate, keys]);

  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    const onFocus = () => setFocused(true);
    const onBlur = () => setFocused(false);
    node.addEventListener("focus", onFocus);
    node.addEventListener("blur", onBlur);
    setFocused(document.activeElement === node);
    return () => {
      node.removeEventListener("focus", onFocus);
      node.removeEventListener("blur", onBlur);
    };
  }, []);

  useLayoutEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const top = form.getBoundingClientRect().top;
    const from = heroTop.current;
    heroTop.current = hero ? top : null;
    if (hero || from === null || Math.abs(from - top) < 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    form.animate([{ transform: `translateY(${from - top}px)` }, { transform: "none" }], {
      duration: 420,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    });
  }, [hero]);

  return (
    <section className={`panel chat${hero ? " chat--hero" : ""}`} aria-label={t("Chat")}>
      {showTabs && !phone && <ChatViewTabs view={view} onChoose={choose} />}
      <div
        className="chat__stream"
        id="chat-panel-conversation"
        ref={stream}
        hidden={showTrajectory}
        {...(phone
          ? {}
          : showTabs
            ? { role: "tabpanel", "aria-labelledby": "chat-tab-conversation" }
            : { role: "region", "aria-label": t("Conversation") })}
        aria-busy={busy}
        onScroll={(event) => {
          lastTop.current = event.currentTarget.scrollTop;
        }}
      >
        <div role="log" aria-live="polite">
          {messages.map((m, i) => (
            <MessageItem
              key={i}
              message={m}
              turn={turns[i] ?? undefined}
              animate={i === revealIndex}
              {...(phone && m.outcome === "planned" && onOpenTrip ? { onOpenTrip } : {})}
              {...(plan && onOpenDay && i === lastPlanned ? { days: { plan, onOpenDay } } : {})}
              {...(onResend && !busy && !locked && !ask
                ? { onResend: (text: string) => onResend(i, text) }
                : {})}
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
          role={showTabs ? "tabpanel" : "region"}
          aria-labelledby={showTabs ? "chat-tab-trajectory" : undefined}
          aria-label={showTabs ? undefined : t("Trajectory")}
        >
          <TrajectoryTab
            key={conversationId}
            messages={messages}
            live={activity}
            busy={busy}
            only={only}
            onClear={() => setOnly(undefined)}
            {...(jump ? { jump, onJumped: () => setJump(undefined) } : {})}
          />
        </div>
      )}
      {facts && <div className="chat__facts">{facts}</div>}
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
          ref={formRef}
          className="chat__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!locked) onSend();
          }}
        >
          {blankUntouched && (
            <div
              className="chat-suggestions chat-empty__suggestions"
              aria-label={t("Example trips")}
            >
              {prompts.slice(0, phone ? 2 : prompts.length).map(({ label, text, params }) => (
                <button
                  key={t(label)}
                  type="button"
                  className="chat-suggestions__chip"
                  title={t(label)}
                  disabled={busy || locked}
                  onClick={() => onSend(translate(locale, text, params))}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          )}
          <Composer
            value={input}
            placeholder={t(keys[placeholderAt] ?? keys[0]!)}
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
      {!(phone && blankUntouched) && (
        <p className="disclaimer">
          {t("Estimates require verification. Nothing here makes a booking.")}
        </p>
      )}
    </section>
  );
}
