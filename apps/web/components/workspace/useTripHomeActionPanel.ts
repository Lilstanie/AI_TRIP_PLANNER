"use client";
import { useEffect, useRef, useState } from "react";
import type { TripAction } from "@/lib/workspace/layout";

export function useTripHomeActionPanel({
  phone,
  narrow,
  tripAction,
  openTripAction,
  closeTripAction,
  viewTransition,
}: {
  phone: boolean;
  narrow: boolean;
  tripAction?: TripAction;
  openTripAction(action: TripAction): void;
  closeTripAction(): void;
  viewTransition(run: () => void): void;
}) {
  const [expanded, setExpanded] = useState(false);
  const returnFocus = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const scrollTop = useRef(0);

  useEffect(() => {
    if (phone || narrow) setExpanded(false);
  }, [narrow, phone]);

  return {
    mainRef,
    returnFocus,
    expanded: !!tripAction && !phone && !narrow && expanded,
    expandable: !phone && !narrow,
    reset() {
      setExpanded(false);
    },
    open(action: TripAction, trigger: HTMLButtonElement, beforeOpen?: () => void) {
      returnFocus.current = trigger;
      scrollTop.current = mainRef.current?.scrollTop ?? 0;
      setExpanded(false);
      viewTransition(() => {
        beforeOpen?.();
        openTripAction(action);
      });
    },
    switchTo(action: TripAction) {
      viewTransition(() => openTripAction(action));
    },
    close() {
      closeTripAction();
      setExpanded(false);
      if (mainRef.current) mainRef.current.scrollTop = scrollTop.current;
      returnFocus.current?.focus({ preventScroll: true });
    },
    toggleExpanded() {
      setExpanded((value) => !value);
    },
  };
}
