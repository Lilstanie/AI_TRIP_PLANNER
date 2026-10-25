"use client";
import { useEffect, useRef, useState } from "react";
import type { AgentProgressEvent, AssistantId } from "@trip/shared";
import type { Message } from "@/lib/workspace";
import { useTrajectoryFocus } from "../chat/trajectory-focus";
import { TrajectoryTab, type TurnJump } from "../trajectory/TrajectoryTab";

export function PhoneTrajectory({
  messages,
  activity,
  busy,
  visible,
  onReveal,
  onPlanInChat,
}: {
  messages: readonly Message[];
  activity: readonly AgentProgressEvent[];
  busy: boolean;
  visible: boolean;
  onReveal: () => void;
  onPlanInChat: () => void;
}) {
  const { focus } = useTrajectoryFocus();
  const [only, setOnly] = useState<AssistantId | undefined>();
  const [jump, setJump] = useState<TurnJump | undefined>();
  const handled = useRef(focus?.nonce ?? 0);
  useEffect(() => {
    if (!focus || focus.nonce === handled.current) return;
    handled.current = focus.nonce;
    setOnly(focus.assistant);
    setJump(focus.turn === undefined ? undefined : { turn: focus.turn, nonce: focus.nonce });
    onReveal();
  });
  if (!visible) return null;
  return (
    <TrajectoryTab
      messages={messages}
      live={activity}
      busy={busy}
      only={only}
      onClear={() => setOnly(undefined)}
      {...(jump ? { jump, onJumped: () => setJump(undefined) } : {})}
      phone
      onPlanInChat={onPlanInChat}
    />
  );
}
