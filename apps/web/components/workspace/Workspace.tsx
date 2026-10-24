"use client";
import { useEffect, useState } from "react";
import { TripPlan } from "@trip/shared";
import { identifyActivities, draftFor } from "@/lib/workspace";
import { restoreWorkspace, type RestoredWorkspace } from "@/lib/workspace/catalog";
import { WorkspaceSkeleton } from "./WorkspaceSkeleton";
import { AccountProvider } from "../account/AccountProvider";
import { SettingsProvider } from "../account/SettingsProvider";
import { LocaleProvider } from "../account/LocaleProvider";
import { WorkspaceView } from "./WorkspaceView";
import { useWorkspace } from "./useWorkspace";
import { TrajectoryFocusProvider, useTrajectoryFocusState } from "../chat/trajectory-focus";

function readableStorage(): Pick<Storage, "getItem"> {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null };
  }
}

export function Workspace({ initialPlan }: { initialPlan?: TripPlan }) {
  const [restored, setRestored] = useState<RestoredWorkspace>();

  useEffect(() => {
    const state = restoreWorkspace(readableStorage());
    if (!initialPlan) {
      setRestored(state);
      return;
    }
    const plan = identifyActivities(initialPlan);
    setRestored({
      ...state,
      plan,
      draft: draftFor(plan.brief),
      messages: undefined,
      input: "",
      conversationId: undefined,
    });
  }, [initialPlan]);

  return (
    <AccountProvider>
      <SettingsProvider>
        {restored ? <WorkspaceContent restored={restored} /> : <WorkspaceSkeleton />}
      </SettingsProvider>
    </AccountProvider>
  );
}

function WorkspaceContent({ restored }: { restored: RestoredWorkspace }) {
  const model = useWorkspace({ restored });
  const trajectoryFocus = useTrajectoryFocusState();
  return (
    <LocaleProvider brief={model.session.draft}>
      <TrajectoryFocusProvider value={trajectoryFocus}>
        <WorkspaceView model={model} />
      </TrajectoryFocusProvider>
    </LocaleProvider>
  );
}
