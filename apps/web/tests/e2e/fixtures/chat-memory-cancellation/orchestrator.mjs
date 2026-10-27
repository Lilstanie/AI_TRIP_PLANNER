export class AskUserError extends Error {}
export class IncompleteBriefError extends Error {}
let runCount = 0;
export const readRunCount = () => runCount;
export const answerFlightQuery = async () => ({ type: "flight_answer", answer: "" });
export const parseFlightQuery = () => undefined;
export async function runTripChat() {
  runCount += 1;
  return {
    reply: "Plan ready.",
    plan: {
      tripId: "cancel-memory-e2e",
      brief: {
        tripId: "cancel-memory-e2e",
        userId: "cancellation-user",
        destination: "Melbourne",
        dates: ["2026-12-01", "2026-12-03"],
        groupSize: 2,
        budgetTotal: 1000,
      },
      round: 1,
      budgetTotal: 1000,
      estTotal: 0,
      overrunPct: 0,
      sections: [],
    },
  };
}
