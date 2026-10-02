import type { AgentLabCheck, AgentLabMetrics, ProposalItem, TripPlan } from "@trip/shared";
import { INFEASIBLE_BUDGET } from "../conflicts";
import { cityNames, normal } from "./cities";
import type { AgentLabScenario } from "./scenarios";

/** Recorded in every artifact so a stale result can be told from one the current rules produced. */
export const AGENT_LAB_EVALUATOR_VERSION = "scenario-rules-v2";

export type AgentLabEvaluation = Pick<
  AgentLabMetrics,
  "withinBudget" | "budgetHeadroom" | "sectionCount" | "checks"
>;

const money = (value: number) => `A$${value.toLocaleString("en-AU")}`;

const DAY_MS = 86_400_000;
const dayNumber = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
const dateOfDay = (start: string, day: number) =>
  new Date((dayNumber(start) + day - 1) * DAY_MS).toISOString().slice(0, 10);

const itemsOf = (plan: TripPlan, section: string): ProposalItem[] =>
  plan.sections.find((candidate) => candidate.id === section)?.proposal?.items ?? [];

/**
 * Whether the plan reports that the budget cannot be met and names the supported minimum. A repairable
 * "over budget" conflict does not count, and neither does naming a different minimum.
 */
function reportsInfeasibleBudget(plan: TripPlan, minimum: number): boolean {
  return (plan.conflicts ?? []).some((conflict) => {
    if (!conflict.reason.startsWith(INFEASIBLE_BUDGET)) return false;
    const text = `${conflict.reason} ${conflict.constraints.join(" ")}`;
    return [...text.matchAll(/AUD\s([\d,]+(?:\.\d+)?)/g)].some(
      (match) => Math.abs(Number(match[1]!.replace(/,/g, "")) - minimum) < 0.005,
    );
  });
}

/**
 * The checks for a trip that moves between cities, derived from the brief's own cities: the hop
 * between each pair falls inside the trip on the date it states, every day's activities are in the city
 * the traveller is in that day, the stays hand over on the hop date, the stays span the trip, and the
 * costs add up. A single-city trip gets none of them.
 */
function multiCityChecks(scenario: AgentLabScenario, plan: TripPlan): AgentLabCheck[] {
  const cities = cityNames(scenario.brief.destination);
  if (cities.length < 2) return [];
  const [start, end] = scenario.brief.dates;
  const nights = dayNumber(end) - dayNumber(start);
  const mentions = (item: ProposalItem, city: string) =>
    normal(`${item.location ?? ""} ${item.detail}`).includes(city);

  // The hop into each later city: a transport item that names the city before it and then this one.
  const hops = cities.slice(1).map((to, index) => {
    const from = cities[index]!;
    return itemsOf(plan, "transport").find((item) => {
      const text = normal(item.detail);
      return text.indexOf(from) >= 0 && text.indexOf(to) > text.indexOf(from);
    });
  });
  const hopDays = hops.map((hop) => hop?.day);
  const hopDates = hops.map((hop) => hop?.detail.match(/\d{4}-\d{2}-\d{2}/)?.[0]);
  const hopsValid = hops.every((hop, index) => {
    const day = hopDays[index];
    return (
      hop !== undefined &&
      day !== undefined &&
      Number.isInteger(day) &&
      day >= 2 &&
      day <= nights &&
      hopDates[index] === dateOfDay(start, day) &&
      (index === 0 || day > hopDays[index - 1]!)
    );
  });

  const activities = itemsOf(plan, "itinerary").filter((item) => item.kind === "activity");
  const cityOfDay = (day: number) => cities[hopDays.filter((hop) => hop! <= day).length]!;
  const itineraryByCity =
    hopsValid &&
    activities.every((item) => item.day !== undefined && item.day >= 1 && item.day <= nights) &&
    Array.from({ length: nights }, (_, index) => index + 1).every((day) => {
      const city = cityOfDay(day);
      const stops = activities.filter((item) => item.day === day);
      return (
        stops.length > 0 &&
        stops.every(
          (item) =>
            mentions(item, city) &&
            cities.every((other) => other === city || !mentions(item, other)),
        )
      );
    });

  // One hotel per city, in travel order, each with the dates its own text states.
  const stays = cities.map((city) => {
    const hotels = itemsOf(plan, "accommodation").filter(
      (item) => item.kind === "hotel" && mentions(item, city),
    );
    const dates =
      hotels.length === 1
        ? hotels[0]!.detail.match(/(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/)
        : null;
    return dates ? { checkIn: dates[1]!, checkOut: dates[2]! } : undefined;
  });
  const stayTransition = stays.every((stay, index) => {
    if (!stay) return false;
    if (index === 0) return true;
    const previous = stays[index - 1]!;
    return stay.checkIn === previous.checkOut && stay.checkIn === hopDates[index - 1];
  });
  const tripDates =
    plan.brief.dates[0] === start &&
    plan.brief.dates[1] === end &&
    stays[0]?.checkIn === start &&
    stays.at(-1)?.checkOut === end;

  const sectionTotal = plan.sections.reduce((sum, section) => sum + section.estCost, 0);
  return [
    {
      id: "hop-date",
      label: `The move between ${cities.join(" and ")} falls inside the trip, on the date it states`,
      passed: hopsValid,
    },
    {
      id: "itinerary-by-city",
      label: "Every day's activities are in the city the traveller is in that day",
      passed: itineraryByCity,
    },
    {
      id: "stay-transition",
      label: "Each stay ends on the day the next one begins, which is the day of the move",
      passed: stayTransition,
    },
    {
      id: "trip-dates",
      label: `The stays span ${start} to ${end}, the trip dates`,
      passed: tripDates,
    },
    {
      id: "total-consistent",
      label: "Section costs add up to the estimate, and the budget is the brief's",
      passed:
        Math.abs(sectionTotal - plan.estTotal) < 0.01 &&
        plan.budgetTotal === scenario.brief.budgetTotal,
    },
  ];
}

/**
 * Measures a plan against the scenario's own constraints. Every check is deterministic and named, so the
 * inspector can show what was measured. Vegetarian is checked as "each meal is marked vegetarian-friendly"
 * because the plan carries no dietary data beyond its own wording.
 */
export function evaluateAgentLabPlan(
  scenario: AgentLabScenario,
  plan: TripPlan,
): AgentLabEvaluation {
  const { rules, brief } = scenario;
  const proposals = plan.sections.flatMap((section) =>
    section.proposal ? [section.proposal] : [],
  );
  const items = proposals.flatMap((proposal) => proposal.items);
  // "HH:MM" strings compare correctly as text. A transfer such as an early train is not an activity.
  const startsEarly = items.some(
    (item) =>
      item.kind === "activity" &&
      item.startTime !== undefined &&
      item.startTime < rules.earliestStartTime,
  );
  const meals = items.filter((item) => item.kind === "meal");
  const withinBudget = plan.estTotal <= plan.budgetTotal;

  // When the evidence shows no plan can meet the budget, "within budget" and "no unresolved conflicts"
  // are checks nobody can pass, so they would mark every strategy down for the request. The checks
  // measure instead whether a plan stays honest about it.
  const infeasible = rules.infeasibleBudget;
  const checks: AgentLabCheck[] = [
    {
      id: "sections",
      label: `All ${rules.sectionCount} comparable plan sections are present`,
      passed: plan.sections.length === rules.sectionCount,
    },
    ...(infeasible
      ? [
          {
            id: "evidence-floor",
            label: `Estimate is not below the ${money(infeasible.minimumSupportedCost)} cheapest supported flights and stays`,
            passed: plan.estTotal >= infeasible.minimumSupportedCost,
          },
          {
            id: "infeasibility-reported",
            label: `The budget shortfall is reported with the ${money(infeasible.minimumSupportedCost)} supported minimum`,
            passed: reportsInfeasibleBudget(plan, infeasible.minimumSupportedCost),
          },
        ]
      : [
          {
            id: "budget",
            label: `Estimate stays within the ${money(plan.budgetTotal)} budget`,
            passed: withinBudget,
          },
          {
            id: "no-conflicts",
            label: "No unresolved cross-section conflicts",
            passed: (plan.conflicts?.length ?? 0) === 0,
          },
        ]),
    {
      id: "destination",
      label: `Plan is for ${brief.destination}`,
      passed: plan.brief.destination === brief.destination,
    },
    {
      id: "no-early-starts",
      label: `No activity starts before ${rules.earliestStartTime}`,
      passed: !startsEarly,
    },
  ];
  if (rules.vegetarianMeals) {
    checks.push({
      id: "vegetarian-meals",
      label: "Every meal is marked vegetarian-friendly",
      passed: meals.length > 0 && meals.every((meal) => /vegetarian/i.test(meal.detail)),
    });
  }

  checks.push(...multiCityChecks(scenario, plan));

  return {
    withinBudget,
    budgetHeadroom: plan.budgetTotal - plan.estTotal,
    sectionCount: plan.sections.length,
    checks,
  };
}
