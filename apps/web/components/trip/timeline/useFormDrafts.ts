"use client";
import { useMemo, useRef } from "react";

export function useFormDrafts() {
  const values = useRef(new Map<string, unknown>());
  return useMemo(
    () => ({
      get<T>(key: string): T | undefined {
        return values.current.get(key) as T | undefined;
      },
      set(key: string, value: unknown) {
        values.current.set(key, value);
      },
      clear(key: string) {
        values.current.delete(key);
      },
    }),
    [],
  );
}

export type FormDrafts = ReturnType<typeof useFormDrafts>;
