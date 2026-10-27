"use client";
import { useEffect, useState } from "react";
import { SHOW_DISTANCES_KEY } from "@/lib/trip/leg-distance";

export function useShowDistances(): [boolean, (next: boolean) => void] {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(SHOW_DISTANCES_KEY) === "0") setShown(false);
    } catch {
      return;
    }
  }, []);
  const choose = (next: boolean) => {
    setShown(next);
    try {
      window.localStorage.setItem(SHOW_DISTANCES_KEY, next ? "1" : "0");
    } catch {
      return;
    }
  };
  return [shown, choose];
}
