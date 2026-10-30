let hovered: string | undefined;
const listeners = new Set<() => void>();

export function hoverStop(activityId: string | undefined) {
  if (hovered === activityId) return;
  hovered = activityId;
  listeners.forEach((listener) => listener());
}

export function hoveredStop() {
  return hovered;
}

export function subscribeStopHover(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
