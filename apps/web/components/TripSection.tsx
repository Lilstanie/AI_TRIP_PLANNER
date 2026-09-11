"use client";

import { useState } from "react";
import type { TripSection as TripSectionData } from "@trip/shared";
import { useLanguage } from "@/components/LanguageContext";

const STATUS_LABEL: Record<TripSectionData["status"], string> = {
  planning: "Planning",
  draft: "Draft",
  needs_you: "Needs you",
  confirmed: "Confirmed",
};

const ICON: Record<string, string> = {
  itinerary: "◷",
  transport: "↗",
  accommodation: "⌂",
  "destination-guide": "◇",
  dining: "○",
};

export function TripSection({ section, index }: { section: TripSectionData; index: number }) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(section.status === "needs_you");
  const bodyId = `section-details-${section.id}`;

  return (
    <li className={`timeline-item timeline-item--${section.status}`}>
      <span className="timeline-number">{index}</span>
      <button
        type="button"
        className="timeline-row"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="timeline-icon" aria-hidden>
          {ICON[section.id] ?? "·"}
        </span>
        <span className="timeline-content">
          <span className="timeline-title">
            <strong>{section.label}</strong>
            <span className={`status-chip status-chip--${section.status}`}>
              {t(STATUS_LABEL[section.status])}
            </span>
          </span>
          <small>{section.summary}</small>
        </span>
        <span className="timeline-cost">USD {Math.round(section.estCost).toLocaleString()}</span>
        <span className={`timeline-chevron ${open ? "timeline-chevron--open" : ""}`} aria-hidden>
          ›
        </span>
      </button>

      {open && (
        <div className="timeline-detail" id={bodyId}>
          {section.proposal ? (
            <>
              <div className="proposal-items">
                {section.proposal.items.length > 0 ? (
                  [...section.proposal.items]
                    .sort(
                      (left, right) =>
                        (left.day ?? 999) - (right.day ?? 999) ||
                        (left.startTime ?? "").localeCompare(right.startTime ?? ""),
                    )
                    .map((item, itemIndex) => (
                      <article
                        className="proposal-item"
                        key={`${item.kind}-${item.day ?? "any"}-${itemIndex}`}
                      >
                        <div className="proposal-item__meta">
                          <span className="proposal-item__kind">
                            {item.kind.replaceAll("-", " ")}
                          </span>
                          {item.day !== undefined && (
                            <span>
                              {language === "zh" ? `第 ${item.day} 天` : `Day ${item.day}`}
                            </span>
                          )}
                          {item.startTime && item.endTime && (
                            <span>
                              {item.startTime}–{item.endTime}
                            </span>
                          )}
                          {item.estCost !== undefined && (
                            <strong>USD {item.estCost.toLocaleString()}</strong>
                          )}
                        </div>
                        {item.location && <h4>{item.location}</h4>}
                        <p>{item.detail}</p>
                      </article>
                    ))
                ) : (
                  <p className="section-empty">{t("No detailed items were returned.")}</p>
                )}
              </div>
              {section.proposal.assumptions.length > 0 && (
                <details className="assumptions">
                  <summary>
                    {t("Important notes")} ({section.proposal.assumptions.length})
                  </summary>
                  <ul>
                    {section.proposal.assumptions.map((assumption, assumptionIndex) => (
                      <li key={assumptionIndex}>{assumption}</li>
                    ))}
                  </ul>
                </details>
              )}
              {section.proposal.conflictsWith.length > 0 && (
                <p className="conflict-note" role="alert">
                  {language === "zh" ? "存在冲突：" : "Conflicts: "}
                  {section.proposal.conflictsWith.join(", ")}
                </p>
              )}
            </>
          ) : (
            <p className="section-empty">{t("Details are still being prepared.")}</p>
          )}
        </div>
      )}
    </li>
  );
}
