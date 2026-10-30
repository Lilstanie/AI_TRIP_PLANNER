/*
 * Adapted from DeepSeek Harness (https://github.com/deepseek-ai/deepseek-harness), commit 687f282e86.
 * Copyright (c) 2026 DeepSeek. Licensed under the MIT licence; see THIRD_PARTY_NOTICES.md.
 */

"use client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { IconChevronRightOutlineRegular, JsonTree, MarkdownText } from "./shim";
import type { TrajectoryTranslate } from "./locales";
import { KIND_LABEL_KEY, KIND_TAG_CLASS } from "./trajectory-kind";
import {
  STEP_TABS,
  detailTabs,
  isMarkdownRecord,
  markdownSource,
  parentTool,
  sectionLabel,
  stateOf,
  statusLabel,
  stepKey,
} from "./trajectory-table-records";
import type { DetailTab, TableRecord, TrajectoryStep } from "./trajectory-table-records";
import tableCss from "./TrajectoryTable.module.css";
import css from "./TrajectoryInspector.module.css";

interface DetailsResizeDrag {
  pointerId: number;
  startX: number;
  startWidth: number;
  splitWidth: number;
  startToolRequestOffset: number;
}

const DETAILS_MIN_WIDTH = 320;
const DETAILS_MAX_WIDTH = 720;
const TABLE_MIN_WIDTH = 280;
const DETAILS_RESIZE_STEP = 16;
const TOOL_REQUEST_SHARE = 0.58;
const TOOL_REQUEST_MIN_WIDTH = 180;
const TOOL_REQUEST_MAX_WIDTH = 480;
const DEFAULT_TOOL_REQUEST_SHARE = 0.36;
const DEFAULT_TOOL_REQUEST_OFFSET = 56;

function clampDetailsWidth(width: number, splitWidth: number): number {
  const maxWidth = Math.max(
    DETAILS_MIN_WIDTH,
    Math.min(DETAILS_MAX_WIDTH, splitWidth - TABLE_MIN_WIDTH),
  );
  return Math.round(Math.min(Math.max(width, DETAILS_MIN_WIDTH), maxWidth));
}

function defaultToolRequestWidth(splitWidth: number): number {
  return Math.min(
    Math.max(
      splitWidth * DEFAULT_TOOL_REQUEST_SHARE - DEFAULT_TOOL_REQUEST_OFFSET,
      TOOL_REQUEST_MIN_WIDTH,
    ),
    TOOL_REQUEST_MAX_WIDTH,
  );
}

function MarkdownFragment({
  text,
  rendered,
  preview,
}: {
  text: string;
  rendered: boolean;
  preview: boolean;
}) {
  if (rendered) {
    return (
      <div className={preview ? css.markdownPreview : css.markdownPayload}>
        <MarkdownText text={text} />
      </div>
    );
  }
  return <pre className={`${css.payload} ${preview ? css.payloadPreview : ""}`}>{text}</pre>;
}

function MarkdownRecordContent({
  record,
  rendered,
  preview = false,
  t,
}: {
  record: TableRecord;
  rendered: boolean;
  preview?: boolean;
  t: TrajectoryTranslate;
}) {
  const source = markdownSource(record);
  if (!source) return <p className={css.noPayload}>{record.cell.text || t("record.noContent")}</p>;
  return <MarkdownFragment text={source} rendered={rendered} preview={preview} />;
}

function parseJsonContainer(value: string): object | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function RecordPayload({
  record,
  direction,
  preview = false,
  t,
}: {
  record: TableRecord;
  direction: "input" | "output";
  preview?: boolean;
  t: TrajectoryTranslate;
}) {
  const value = direction === "input" ? record.cell.inputDetail : record.cell.outputDetail;
  if (!value) {
    return (
      <p className={css.noPayload}>
        {direction === "input" ? t("record.noPayload") : t("record.noResult")}
      </p>
    );
  }
  const error = direction === "output" && record.cell.isError === true;
  const payloadClass = preview ? css.jsonPreview : css.jsonPayload;
  const json = parseJsonContainer(value);
  if (json !== undefined) {
    return (
      <JsonTree
        data={json}
        className={error ? `${payloadClass} ${css.errorPayload}` : payloadClass}
      />
    );
  }
  return (
    <pre
      className={[
        css.payload,
        preview ? css.payloadPreview : undefined,
        error ? css.errorPayload : undefined,
      ]
        .filter((className): className is string => className !== undefined)
        .join(" ")}
    >
      {value}
    </pre>
  );
}

function OverviewSection({
  label,
  onOpen,
  children,
}: {
  label: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);
  const measureOverflow = useCallback((preview: HTMLElement) => {
    setHasMore(preview.scrollHeight - preview.clientHeight - preview.scrollTop > 1);
  }, []);

  useLayoutEffect(() => {
    const preview = previewRef.current as HTMLDivElement;
    const measure = () => {
      measureOverflow(preview);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(preview);
    for (const child of preview.children) observer.observe(child);
    return () => {
      observer.disconnect();
    };
  }, [children, measureOverflow]);

  return (
    <section className={css.overviewSection}>
      <h3 className={css.overviewHeading}>
        <button type="button" className={css.overviewTitle} onClick={onOpen}>
          <span>{label}</span>
          <IconChevronRightOutlineRegular className={css.overviewTitleIcon} size={12} />
        </button>
      </h3>
      <div
        ref={previewRef}
        className={`${css.overviewPreview} ${css.summaryScrollRegion}`}
        data-summary-scroll-region=""
        data-scroll-more={hasMore || undefined}
        onScroll={(event) => {
          measureOverflow(event.currentTarget);
        }}
      >
        {children}
      </div>
    </section>
  );
}

function HierarchyLink({ label, onOpen }: { label: string; onOpen: () => void }) {
  return (
    <button type="button" className={css.overviewHierarchyNavLink} onClick={onOpen}>
      <span>{label}</span>
      <IconChevronRightOutlineRegular className={css.overviewHierarchyJumpIconTight} size={11} />
    </button>
  );
}

export interface TrajectoryInspectorProps {
  t: TrajectoryTranslate;
  allRecords: readonly TableRecord[];
  stepsByKey: ReadonlyMap<string, TrajectoryStep>;
  step: TrajectoryStep | undefined;
  stepRecords: readonly TableRecord[];
  record: TableRecord | undefined;
  activeTab: DetailTab;
  onActivateTab: (tab: DetailTab) => void;
  onClose: () => void;
  onSelectStep: (step: TrajectoryStep) => void;
  onOpenRecord: (record: TableRecord) => void;
  detailsWidth: number | null;
  toolRequestOffset: number | null;
  onResize: (detailsWidth: number | null, toolRequestOffset: number | null) => void;
}

/**
 * Render the resizable inspector for the selected trajectory step or record.
 * Width state stays with the caller so it survives closing and reopening the inspector.
 * @param props - The selection, its records and the caller-owned width state.
 * @returns The inspector aside.
 */
export function TrajectoryInspector({
  t,
  allRecords,
  stepsByKey,
  step: selectedStepInfo,
  stepRecords: selectedStepRecords,
  record: selected,
  activeTab,
  onActivateTab: activateTab,
  onClose: closeInspector,
  onSelectStep: selectStep,
  onOpenRecord: openRecordSummary,
  detailsWidth,
  toolRequestOffset,
  onResize,
}: TrajectoryInspectorProps) {
  const detailsResizeDrag = useRef<DetailsResizeDrag | null>(null);
  const selectedState = selected === undefined ? undefined : stateOf(selected);
  const selectedStepAssistant = selectedStepRecords.find(
    (record) => record.cell.kind === "message",
  );
  const selectedStepToolCalls = selectedStepRecords.filter(
    (record) => record.cell.kind === "tool",
  ).length;
  const selectedStepSubtoolCalls = selectedStepRecords.filter(
    (record) => record.cell.kind === "subtool",
  ).length;
  const selectedTabs =
    selectedStepInfo !== undefined ? STEP_TABS : selected === undefined ? [] : detailTabs(selected);
  const selectedParentTool = selected === undefined ? undefined : parentTool(allRecords, selected);
  const selectedAssistantStep =
    selected?.cell.kind === "message"
      ? stepsByKey.get(stepKey(selected.turn, selected.group))
      : undefined;

  return (
    <aside
      className={`${css.details} glass-float--raised`}
      aria-label={t("details.event")}
      style={detailsWidth === null ? undefined : { width: detailsWidth }}
    >
      <div
        className={css.detailsResizeHandle}
        role="separator"
        aria-label={t("details.resize")}
        aria-controls="trajectory-detail-panel"
        aria-orientation="vertical"
        tabIndex={0}
        onDoubleClick={() => {
          onResize(null, null);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const details = event.currentTarget.parentElement;
          const split = details?.parentElement;
          if (details === null || details === undefined || split === null || split === undefined)
            return;
          const splitWidth = split.getBoundingClientRect().width;
          detailsResizeDrag.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startWidth: details.getBoundingClientRect().width,
            splitWidth,
            startToolRequestOffset:
              toolRequestOffset ??
              splitWidth * TOOL_REQUEST_SHARE - defaultToolRequestWidth(splitWidth),
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          const drag = detailsResizeDrag.current;
          if (drag === null || drag.pointerId !== event.pointerId) return;
          const nextDetailsWidth = clampDetailsWidth(
            drag.startWidth + drag.startX - event.clientX,
            drag.splitWidth,
          );
          onResize(
            nextDetailsWidth,
            drag.startToolRequestOffset + (nextDetailsWidth - drag.startWidth) * TOOL_REQUEST_SHARE,
          );
        }}
        onPointerUp={(event) => {
          if (detailsResizeDrag.current?.pointerId !== event.pointerId) return;
          detailsResizeDrag.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          detailsResizeDrag.current = null;
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          const details = event.currentTarget.parentElement;
          const split = details?.parentElement;
          if (details === null || details === undefined || split === null || split === undefined)
            return;
          const direction = event.key === "ArrowLeft" ? 1 : -1;
          const currentDetailsWidth = details.getBoundingClientRect().width;
          const splitWidth = split.getBoundingClientRect().width;
          const nextDetailsWidth = clampDetailsWidth(
            currentDetailsWidth + direction * DETAILS_RESIZE_STEP,
            splitWidth,
          );
          const currentToolRequestOffset =
            toolRequestOffset ??
            splitWidth * TOOL_REQUEST_SHARE - defaultToolRequestWidth(splitWidth);
          onResize(
            nextDetailsWidth,
            currentToolRequestOffset +
              (nextDetailsWidth - currentDetailsWidth) * TOOL_REQUEST_SHARE,
          );
          event.preventDefault();
        }}
      />
      <div className={css.detailsHeader}>
        <div className={css.detailsTitle}>
          {selectedStepInfo !== undefined ? (
            <>
              <span className={css.stepDetailsDot} aria-hidden="true" />
              <span className={css.stepDetailsName}>
                {t("step.label", { step: selectedStepInfo.step })}
              </span>
              <span className={css.detailsLocation}>{sectionLabel(selectedStepInfo.turn, t)}</span>
            </>
          ) : (
            selected !== undefined && (
              <>
                <span className={`${tableCss.kindTag} ${KIND_TAG_CLASS[selected.cell.kind]}`}>
                  {t(KIND_LABEL_KEY[selected.cell.kind])}
                </span>
                <span className={css.detailsLocation}>
                  {`${sectionLabel(selected.turn, t)} · ${selected.group}`}
                </span>
              </>
            )
          )}
        </div>
        <button
          type="button"
          className={css.close}
          aria-label={t("details.close")}
          onClick={closeInspector}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div className={css.detailTabs} role="tablist" aria-label={t("details.event")}>
        {selectedTabs.map((tab) => (
          <button
            key={tab.id}
            id={`trajectory-detail-${tab.id}`}
            type="button"
            role="tab"
            aria-controls="trajectory-detail-panel"
            aria-selected={activeTab === tab.id}
            className={
              activeTab === tab.id ? `${css.detailTab} ${css.detailTabActive}` : css.detailTab
            }
            onClick={() => {
              activateTab(tab.id);
            }}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>
      <div
        id="trajectory-detail-panel"
        className={
          activeTab === "overview" ? `${css.detailBody} ${css.detailBodySummary}` : css.detailBody
        }
        role="tabpanel"
        aria-labelledby={`trajectory-detail-${activeTab}`}
      >
        {selectedStepInfo !== undefined && activeTab === "overview" && (
          <dl
            className={`${css.overview} ${css.summaryScrollRegion}`}
            data-summary-scroll-region=""
          >
            <div>
              <dt>{t("details.status")}</dt>
              <dd className={selectedStepInfo.status === "error" ? css.error : undefined}>
                {statusLabel(selectedStepInfo.status, t)}
              </dd>
            </div>
            <div>
              <dt>{t("details.toolCalls")}</dt>
              <dd>{selectedStepToolCalls}</dd>
            </div>
            {selectedStepSubtoolCalls > 0 && (
              <div>
                <dt>{t("details.subtoolCalls")}</dt>
                <dd>{selectedStepSubtoolCalls}</dd>
              </div>
            )}
            {selectedStepAssistant !== undefined && (
              <div>
                <dt>{t("details.result")}</dt>
                <dd className={css.overviewParentLinks}>
                  <HierarchyLink
                    label={t("details.assistantMessage")}
                    onOpen={() => {
                      openRecordSummary(selectedStepAssistant);
                    }}
                  />
                </dd>
              </div>
            )}
          </dl>
        )}
        {selected !== undefined && selectedState !== undefined && activeTab === "overview" && (
          <>
            <dl
              className={`${css.overview} ${css.summaryScrollRegion}`}
              data-summary-scroll-region=""
            >
              {(selectedAssistantStep !== undefined || selectedParentTool !== undefined) && (
                <div>
                  <dt>{t("details.hierarchy")}</dt>
                  <dd className={css.overviewParentLinks}>
                    {selectedAssistantStep !== undefined && (
                      <HierarchyLink
                        label={t("step.label", { step: selectedAssistantStep.step })}
                        onOpen={() => {
                          selectStep(selectedAssistantStep);
                        }}
                      />
                    )}
                    {selectedParentTool !== undefined && (
                      <HierarchyLink
                        label={t("details.toolCall")}
                        onOpen={() => {
                          openRecordSummary(selectedParentTool);
                        }}
                      />
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt>{t("details.status")}</dt>
                <dd className={selectedState === "error" ? css.error : undefined}>
                  {statusLabel(selectedState, t)}
                </dd>
              </div>
            </dl>
            <div className={css.overviewSections}>
              {isMarkdownRecord(selected) ? (
                <OverviewSection
                  label={t("tab.preview")}
                  onOpen={() => {
                    activateTab("rendered");
                  }}
                >
                  <MarkdownRecordContent record={selected} rendered preview t={t} />
                </OverviewSection>
              ) : (
                <>
                  {selected.cell.inputDetail && (
                    <OverviewSection
                      label={t("tab.payload")}
                      onOpen={() => {
                        activateTab("input");
                      }}
                    >
                      <RecordPayload record={selected} direction="input" preview t={t} />
                    </OverviewSection>
                  )}
                  {selected.cell.outputDetail && (
                    <OverviewSection
                      label={t("tab.result")}
                      onOpen={() => {
                        activateTab("output");
                      }}
                    >
                      <RecordPayload record={selected} direction="output" preview t={t} />
                    </OverviewSection>
                  )}
                </>
              )}
            </div>
          </>
        )}
        {selected !== undefined && activeTab === "rendered" && (
          <MarkdownRecordContent record={selected} rendered t={t} />
        )}
        {selected !== undefined && activeTab === "raw" && (
          <MarkdownRecordContent record={selected} rendered={false} t={t} />
        )}
        {selected !== undefined && activeTab === "input" && (
          <RecordPayload record={selected} direction="input" t={t} />
        )}
        {selected !== undefined && activeTab === "output" && (
          <RecordPayload record={selected} direction="output" t={t} />
        )}
      </div>
    </aside>
  );
}
