import type { RevisionRequest } from "@trip/shared";

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
