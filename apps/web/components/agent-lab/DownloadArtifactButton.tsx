"use client";

import type { AgentLabRunArtifact } from "@trip/shared";
import { downloadArtifact } from "@/lib/agent-lab/replay";

export function DownloadArtifactButton({
  artifact,
  label,
  onDownloaded,
}: {
  artifact: AgentLabRunArtifact;
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
