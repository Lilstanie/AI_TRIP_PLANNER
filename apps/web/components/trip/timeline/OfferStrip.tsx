"use client";
import type { ReactNode } from "react";
import type { AgentProposalSource } from "@trip/shared";
import { useLocale } from "../../account/LocaleProvider";
import { ChevronIcon } from "../../ui/icons";
import { useScrollOverflow } from "../../ui/useScrollOverflow";
import { SourceBadge } from "../SourceBadge";

export function OfferTags({ tags }: { tags: { key: string; label: string }[] }) {
  if (!tags.length) return null;
  return (
    <p className="offer__tags">
      {tags.map((tag) => (
        <span key={tag.key} className={`offer__tag offer__tag--${tag.key}`}>
          {tag.label}
        </span>
      ))}
    </p>
  );
}

export function priceComparison(
  t: ReturnType<typeof useLocale>["t"],
  money: (value: number) => string,
  price: number,
  current: number,
  kind: "flight" | "stay",
): string {
  const delta = Math.round((price - current) * 100) / 100;
  if (delta === 0) return t(kind === "flight" ? "fareSamePrice" : "staySamePrice");
  const amount = money(Math.abs(delta));
  if (kind === "flight")
    return delta > 0 ? t("fareCostsMore", { amount }) : t("fareSaves", { amount });
  return delta > 0 ? t("stayCostsMore", { amount }) : t("staySaves", { amount });
}

export function OfferStrip({
  label,
  source,
  meta,
  items,
}: {
  label: string;
  source?: AgentProposalSource;
  meta: string;
  items: { key: string; card: ReactNode; note?: string }[];
}) {
  const { t } = useLocale();
  const { strip, more, scroll } = useScrollOverflow<HTMLOListElement>();
  return (
    <section className="offer-strip" aria-label={label}>
      <p className="offer-strip__head">
        <SourceBadge source={source} compact />
        <span>{meta}</span>
        <span className="offer-strip__nav">
          <button
            type="button"
            tabIndex={-1}
            className="plan-days__scroll plan-days__scroll--start"
            aria-label={t("previousOptions")}
            disabled={!more.start}
            onClick={() => scroll(-1)}
          >
            <ChevronIcon />
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="plan-days__scroll plan-days__scroll--end"
            aria-label={t("moreOptions")}
            disabled={!more.end}
            onClick={() => scroll(1)}
          >
            <ChevronIcon />
          </button>
        </span>
      </p>
      <div
        className="offer-strip__scroller"
        data-more-start={more.start || undefined}
        data-more-end={more.end || undefined}
      >
        <ol ref={strip} className="offer-strip__list">
          {items.map((item) => (
            <li key={item.key} className="offer">
              {item.card}
              {item.note && <p className="offer__note">{item.note}</p>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
