import type { RevisionRequest } from "@trip/shared";

export const REVISION_INTENT_RULE =
  "revision.intent is authoritative for saving and scheduling. Treat reason and constraints as context; do not infer those intents from their wording or a saving target. ";

export function revisionIntent(revision?: RevisionRequest): { budget: boolean; schedule: boolean } {
  if (revision?.kind !== "request") {
    return { budget: revision?.kind === "budget", schedule: revision?.kind === "time" };
  }
  const text = [revision.reason, ...revision.constraints].join(" ");
  return {
    budget: /budget|cost|cheaper|overrun|cut|reduce/i.test(text),
    schedule: /time|overlap|schedule/i.test(text),
  };
}
