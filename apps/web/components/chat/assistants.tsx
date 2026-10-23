"use client";
import type { ComponentType } from "react";
import type { AssistantId } from "@trip/shared";
import type { MessageKey } from "@/lib/i18n/locale";
import { labels } from "./thinking-model";
import {
  FlowAttractionIcon,
  FlowFlightIcon,
  FlowRestaurantIcon,
  FlowRouteIcon,
  FlowSparkleIcon,
  FlowStayIcon,
} from "../ui/flow-icons";

type IconComponent = ComponentType<{ className?: string }>;

export const ASSISTANT_ICONS: Record<AssistantId, IconComponent> = {
  coordinator: FlowSparkleIcon,
  itinerary: FlowRouteIcon,
  transport: FlowFlightIcon,
  accommodation: FlowStayIcon,
  "destination-guide": FlowAttractionIcon,
  dining: FlowRestaurantIcon,
};

export const ASSISTANT_ROLE_KEYS: Record<AssistantId, MessageKey> = {
  coordinator: "Coordinator",
  ...labels,
};

export function AssistantIcon({ id, className }: { id: AssistantId; className?: string }) {
  const Icon = ASSISTANT_ICONS[id];
  return (
    <span className={`assistant-icon assistant-icon--${id}${className ? ` ${className}` : ""}`}>
      <Icon />
    </span>
  );
}
