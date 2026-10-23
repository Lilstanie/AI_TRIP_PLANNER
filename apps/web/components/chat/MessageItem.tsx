"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import type { Components } from "react-markdown";
import { memoryDisplay } from "@/lib/account/memory-display";
import { intlLocale } from "@/lib/i18n/locale";
import { formatMessageClock, WELCOME_MESSAGE, type Message } from "@/lib/workspace";
import { AttachmentChip } from "./AttachmentChip";
import { FlightResults } from "./FlightResults";
import { RevealedText } from "./RevealedText";
import { ThinkingProcess } from "./ThinkingProcess";
import { useState } from "react";
import { AssistantIcon } from "./assistants";
import { useAssistantName } from "./assistant-names";
import { TeamConversation } from "./TeamConversation";

const markdownComponents: Components = {
  a: ({ href, children, ...rest }) => (
    <a {...rest} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

export function MessageItem({ message, animate }: { message: Message; animate?: boolean }) {
  const { t, locale } = useLocale();
  const [undone, setUndone] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const assistantName = useAssistantName();
  const clock =
    message.at === undefined ? null : (
      <span className="msg-item__clock">
        {formatMessageClock(message.at, Date.now(), intlLocale(locale))}
      </span>
    );
  if (message.role === "user") {
    return (
      <div className="msg-item msg-item--user">
        <span className="sr-only">{t("You")}</span>
        {message.attachments && message.attachments.length > 0 && (
          <ul className="attachment-chips msg-item__attachments" aria-label={t("Attached files")}>
            {message.attachments.map((attachment, index) => (
              <AttachmentChip
                key={`${attachment.name}:${index}`}
                name={attachment.name}
                kind={attachment.kind}
                {...(attachment.thumbnail ? { thumbnail: attachment.thumbnail } : {})}
                {...(attachment.bytes === undefined ? {} : { bytes: attachment.bytes })}
              />
            ))}
          </ul>
        )}

        {message.text && <div className="msg-item__bubble">{message.text}</div>}
        {clock}
      </div>
    );
  }
  return (
    <div className="msg-item msg-item--agent">
      {message.assistant ? (
        <span className="msg-item__who">
          <AssistantIcon id={message.assistant} />
          <strong>{assistantName(message.assistant)}</strong>
        </span>
      ) : (
        <span className="sr-only">{t("Travel planning assistant")}</span>
      )}
      {message.activity && message.activity.length > 0 && (
        <>
          <TeamConversation activity={message.activity} settled />
          <section className="agent-activity" aria-label={t("Thinking process")}>
            <ThinkingProcess activity={message.activity} busy={false} outcome={message.outcome} />
          </section>
        </>
      )}
      <div className="msg-item__body">
        <RevealedText
          text={message.text === WELCOME_MESSAGE ? t(WELCOME_MESSAGE) : message.text}
          components={markdownComponents}
          {...(animate ? { animate } : {})}
        />
      </div>
      {message.memoryChange && (
        <div role="status" className="msg-item__memory-notice">
          {t(
            message.memoryChange.action === "updated" ? "Updated: {value}" : "Remembered: {value}",
            { value: memoryDisplay(message.memoryChange.value, locale) },
          )}
          <button
            type="button"
            disabled={undone || undoing}
            onClick={async () => {
              setUndoing(true);
              try {
                const response = await fetch("/api/account/memory/undo", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ token: message.memoryChange?.token }),
                });
                if (response.ok && (await response.json()).undone) setUndone(true);
              } finally {
                setUndoing(false);
              }
            }}
          >
            {undone ? t("Undone") : t("Undo")}
          </button>
        </div>
      )}
      {message.flights && <FlightResults answer={message.flights} />}
      {clock}
    </div>
  );
}
