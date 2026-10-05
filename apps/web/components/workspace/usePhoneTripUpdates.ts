"use client";
import type { WorkspaceController } from "./useWorkspaceController";

/**
 * Whether the plan changed since the traveller last looked at the Trip tab, and the browser back
 * handling for open sheets. Filled in by #181.
 */
export function usePhoneTripUpdates(_model: WorkspaceController) {
  return { tripUpdated: false };
}
