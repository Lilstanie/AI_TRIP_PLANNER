"use client";

import type { AgentLabCompletedRunArtifact } from "@trip/shared";
import { downloadArtifact } from "@/lib/agent-lab/replay";

/** Saves one completed run's artifact. The name carries the strategy so three buttons stay distinct. */
export function DownloadArtifactButton({
  artifact,
  label,
  onDownloaded,
}: {
  artifact: AgentLabCompletedRunArtifact;
  label: string;
  onDownloaded: (filename: string) => void;
}) {
  return (
    <button
      className="agent-lab__secondary agent-lab__download"
      type="button"
      aria-label={`Download artifact for ${label}`}
      onClick={() => onDownloaded(downloadArtifact(artifact))}
    >
      Download artifact
    </button>
  );
}
