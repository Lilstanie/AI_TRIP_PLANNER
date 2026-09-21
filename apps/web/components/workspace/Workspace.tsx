"use client";
import { useEffect, useState } from "react";
import { TripPlan } from "@trip/shared";
import { identifyActivities, draftFor } from "@/lib/workspace";
import { restoreWorkspace, type RestoredWorkspace } from "@/lib/workspace/catalog";
import { WorkspaceSkeleton } from "./WorkspaceSkeleton";
import { WorkspaceView } from "./WorkspaceView";
import { useWorkspaceController } from "./useWorkspaceController";

function readableStorage(): Pick<Storage, "getItem"> {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null };
  }
}

/**
 * The planning workspace always opens on a blank planning entry. Saved chats and trips are
 * listed in the sidebar and open only when the user chooses them; no demo plan is loaded.
 * `initialPlan` lets an embedding page (or a test) open a specific plan explicitly.
 */
export function Workspace({ initialPlan }: { initialPlan?: TripPlan }) {
  const [restored, setRestored] = useState<RestoredWorkspace>();

  useEffect(() => {
    // Storage is read after hydration, so the server and first client render match.
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

  return restored ? <WorkspaceContent restored={restored} /> : <WorkspaceSkeleton />;
}

function WorkspaceContent({ restored }: { restored: RestoredWorkspace }) {
  const model = useWorkspaceController({ restored });
  return <WorkspaceView model={model} />;
}
