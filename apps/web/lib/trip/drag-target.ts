export type DropZone = { kind: "day"; day: number } | { kind: "ideas" };

export type DragSource = { id: string; zone: DropZone };

export type DropTarget = { zone: DropZone; index: number };

export function zoneKey(zone: DropZone): string {
  return zone.kind === "day" ? `day:${zone.day}` : "ideas";
}

export function parseZone(key: string | null | undefined): DropZone | undefined {
  if (key === "ideas") return { kind: "ideas" };
  const day = /^day:(\d+)$/.exec(key ?? "")?.[1];
  return day ? { kind: "day", day: Number(day) } : undefined;
}

export function sameZone(left: DropZone, right: DropZone): boolean {
  return zoneKey(left) === zoneKey(right);
}

export function insertionIndex(midpoints: readonly number[], pointerY: number): number {
  return midpoints.filter((middle) => middle < pointerY).length;
}
