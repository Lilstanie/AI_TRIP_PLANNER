"use client";
import { useEffect, useRef, useState } from "react";
import { motionAllowed } from "./motion";

/** Tracks whether a horizontal strip has hidden content before or after the visible part. */
export function useScrollOverflow<T extends HTMLElement>() {
  const strip = useRef<T>(null);
  const [more, setMore] = useState({ start: false, end: false });
  useEffect(() => {
    const node = strip.current;
    if (!node) return;
    const measure = () => {
      const start = node.scrollLeft > 1;
      const end = node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
      setMore((current) =>
        current.start === start && current.end === end ? current : { start, end },
      );
    };
    measure();
    node.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, []);
  const scroll = (direction: 1 | -1) => {
    const node = strip.current;
    if (!node) return;
    node.scrollBy({
      left: direction * node.clientWidth * 0.8,
      behavior: motionAllowed() ? "smooth" : "auto",
    });
  };
  return { strip, more, scroll };
}
