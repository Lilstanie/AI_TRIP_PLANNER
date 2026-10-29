"use client";
import { useMemo, useState, type ReactNode } from "react";
import type { TripPlan } from "@trip/shared";
import { TripEditorView } from "../trip/TripEditor";
import { TripDrawerEmpty } from "../trip/TripDrawerEmpty";
import { createEditorDrafts, EditorDraftProvider } from "../trip/editor-drafts";
import { useAutoSavePlaces } from "../trip/useAutoSavePlaces";
import { useLegRoutes } from "../trip/useLegRoutes";
import { usePlanRevision } from "../trip/plan-revision";
import { useChooseCandidate } from "../trip/useChooseCandidate";
import { TripPanel } from "../trip/TripPanel";
import { useTripPlaces, type TripPlaces } from "../map/useTripPlaces";
import { useTripUndo } from "../trip/useTripUndo";
import { useTimelineEdits } from "../trip/timeline/useTimelineEdits";
import { itineraryActivities } from "@/lib/workspace";
import type { DataMode, DataModeProviders } from "@/lib/workspace/data-mode";
import type { RouteResult } from "@/lib/integrations/google";
import type { MobileView } from "./workspace-helpers";

type DataModeState = {
  mode?: DataMode;
  providers?: DataModeProviders;
};

export function useWorkspaceTripEditor({
  page,
  editorPlan,
  plan,
  sessionOwnsEditor,
  tripPlaces,
  dataMode,
  locale,
  editPending,
  busy,
  selectedActivity,
  mapRoutes,
  mapDay,
  phone,
  narrow,
  onApplyEdit,
  onTrackEdit,
  onSelectStop,
  onShowRoutes,
  onSetTimelineChanged,
  onPickMapDay,
  onSendFromTrip,
  onSelectView,
  onShowTripMap,
  onEdit,
}: {
  page: string;
  editorPlan?: TripPlan;
  plan?: TripPlan;
  sessionOwnsEditor: boolean;
  tripPlaces: TripPlaces;
  dataMode: DataModeState;
  locale: "en" | "zh";
  editPending: boolean;
  busy: boolean;
  selectedActivity?: string;
  mapRoutes: RouteResult[];
  mapDay?: number;
  phone: boolean;
  narrow: boolean;
  onApplyEdit(next: TripPlan): void;
  onTrackEdit(value: boolean): void;
  onSelectStop(id: string): void;
  onShowRoutes(routes: RouteResult[]): void;
  onSetTimelineChanged(changed: boolean): void;
  onPickMapDay(day: number): void;
  onSendFromTrip(message: string): void;
  onSelectView(view: MobileView): void;
  onShowTripMap(): void;
  onEdit(): void;
}) {
  const [editorDrafts] = useState(createEditorDrafts);
  const homeTripPlaces = useTripPlaces(
    page === "home" ? editorPlan : undefined,
    tripPlaces.dataMode,
    locale,
    tripPlaces.forceOsm,
    tripPlaces.allowFallback,
  );
  const editorTripPlaces = page === "home" ? homeTripPlaces : tripPlaces;
  const undo = useTripUndo(editorPlan);
  const revisions = usePlanRevision({
    plan: editorPlan,
    held: editPending,
    dataMode: dataMode.mode,
    onApply: (next, backgroundBase) => {
      if (backgroundBase) undo.preserveBackground(backgroundBase, next);
      onApplyEdit(next);
    },
  });
  const chooser = useChooseCandidate(editorPlan, revisions, onTrackEdit);
  const autoSaves = useAutoSavePlaces({
    plan: sessionOwnsEditor ? editorPlan : undefined,
    tripPlaces: editorTripPlaces,
    revisions,
  });
  const legs = useLegRoutes({
    plan: sessionOwnsEditor ? editorPlan : undefined,
    revisions,
    onRoutes: onShowRoutes,
  });
  const timelineEdits = useTimelineEdits({
    plan: (sessionOwnsEditor ? editorPlan : plan)!,
    dataMode: dataMode.mode,
    activities: useMemo(() => itineraryActivities(editorPlan), [editorPlan]),
    revisions,
    undo,
    onPending: onTrackEdit,
    onRoutesChange: onShowRoutes,
    onLegApplied: legs.noteLeg,
    onTimelineChange: onSetTimelineChanged,
  });
  const tripContent: ReactNode = editorPlan ? (
    <EditorDraftProvider store={editorDrafts} tripId={editorPlan.tripId}>
      <TripPanel
        key={editorPlan.tripId}
        plan={editorPlan}
        {...(chooser.problem ? { problem: chooser.problem } : {})}
        timeline={
          <TripEditorView
            plan={editorPlan}
            disabled={busy || editPending}
            onPending={onTrackEdit}
            tripPlaces={editorTripPlaces}
            selected={selectedActivity}
            day={mapDay}
            onDayChange={onPickMapDay}
            onSelect={onSelectStop}
            onSend={onSendFromTrip}
            onRoutesChange={onShowRoutes}
            onApply={onApplyEdit}
            revisions={revisions}
            undo={undo}
            routes={mapRoutes}
            legs={legs}
            onLegApplied={legs.noteLeg}
            onTimelineChange={onSetTimelineChanged}
            onShowMap={(value) => {
              onPickMapDay(value);
              if (phone) onSelectView("map");
              else if (narrow) onShowTripMap();
            }}
            showPhotos={dataMode.mode === "live" && !!dataMode.providers?.maps}
            saves={autoSaves}
            phone={phone}
            edits={timelineEdits}
            {...(busy || editPending || chooser.working ? {} : { onChoose: chooser.choose })}
          />
        }
      />
    </EditorDraftProvider>
  ) : (
    <TripDrawerEmpty
      phone={phone}
      onPlanInChat={() => onSelectView("chat")}
      onAddDetails={onEdit}
    />
  );
  return { undo, timelineEdits, tripContent };
}
