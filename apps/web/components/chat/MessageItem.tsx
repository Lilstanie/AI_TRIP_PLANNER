"use client";
import type { Components } from "react-markdown";
import { formatMessageClock, type Message } from "@/lib/workspace";
import { AttachmentChip } from "./AttachmentChip";
import { FlightResults } from "./FlightResults";
import { RevealedText } from "./RevealedText";
import { ThinkingProcess } from "./ThinkingProcess";

/** Links in an agent reply open in a new tab without handing it a referrer or window opener. */
const markdownComponents: Components = {
  a: ({ href, children, ...rest }) => (
    <a {...rest} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

/**
 * One turn in the chat stream, styled after DeepSeek Harness's
 * `MessageItem`/`AssistantMarkdown`: the traveller's own words sit in a
 * right-aligned bubble, the assistant's reply is full-width prose with no
 * border, background or visible speaker label. Both carry a small clock
 * underneath once the message has a timestamp (`at` is optional so a trip
 * saved before this change still loads and simply shows no clock).
 *
 * A message sent with files shows them as chips above its bubble, the way DSH's
 * `MessageItem` puts its attachment row above the user text. What is stored is
 * only a thumbnail and the file's identity, so a restored transcript shows the
 * same chips without carrying the sent payload in browser storage.
 *
 * `animate` reveals the reply word by word; ChatPanel sets it for the one
 * agent message that arrived during this session, and `RevealedText` latches
 * it on mount so the reveal never replays.
 */
export function MessageItem({ message, animate }: { message: Message; animate?: boolean }) {
  const clock =
    message.at === undefined ? null : (
      <span className="msg-item__clock">{formatMessageClock(message.at)}</span>
    );
  if (message.role === "user") {
    return (
      <div className="msg-item msg-item--user">
        <span className="sr-only">You</span>
        {message.attachments && message.attachments.length > 0 && (
          <ul className="attachment-chips msg-item__attachments" aria-label="Attached files">
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
        {/* A turn can be files alone; an empty bubble would be a blank box. */}
        {message.text && <div className="msg-item__bubble">{message.text}</div>}
        {clock}
      </div>
    );
  }
  return (
    <div className="msg-item msg-item--agent">
      <span className="sr-only">Travel planning assistant</span>
      {message.activity && message.activity.length > 0 && (
        <section className="agent-activity" aria-label="Thinking process">
          <ThinkingProcess activity={message.activity} busy={false} />
        </section>
      )}
      <div className="msg-item__body">
        <RevealedText
          text={message.text}
          components={markdownComponents}
          {...(animate ? { animate } : {})}
        />
      </div>
      {message.flights && <FlightResults answer={message.flights} />}
      {clock}
    </div>
  );
}
