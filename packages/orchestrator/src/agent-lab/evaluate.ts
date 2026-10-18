import type { AgentLabCheck, AgentLabMetrics, ProposalItem, TripPlan } from "@trip/shared";
import { INFEASIBLE_BUDGET } from "../conflicts";
import { cityNames, normal } from "./cities";
import type { AgentLabScenario } from "./scenarios";

export const AGENT_LAB_EVALUATOR_VERSION = "scenario-rules-v7";

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

function reportsInfeasibleBudget(plan: TripPlan, minimum: number): boolean {
  return (plan.conflicts ?? []).some((conflict) => {
    if (!conflict.reason.startsWith(INFEASIBLE_BUDGET)) return false;
    const text = `${conflict.reason} ${conflict.constraints.join(" ")}`;
    return [...text.matchAll(/AUD\s([\d,]+(?:\.\d+)?)/g)].some(
      (match) => Math.abs(Number(match[1]!.replace(/,/g, "")) - minimum) < 0.005,
    );
  });
}

function multiCityChecks(scenario: AgentLabScenario, plan: TripPlan): AgentLabCheck[] {
  const cities = cityNames(scenario.brief.destination);
  if (cities.length < 2) return [];
  const [start, end] = scenario.brief.dates;
  const days = dayNumber(end) - dayNumber(start) + 1;
  const mentions = (item: ProposalItem, city: string) =>
    normal(`${item.location ?? ""} ${item.detail}`).includes(city);

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
      day <= days &&
      hopDates[index] === dateOfDay(start, day) &&
      (index === 0 || day > hopDays[index - 1]!)
    );
  });

  const activities = itemsOf(plan, "itinerary").filter((item) => item.kind === "activity");
  const cityOfDay = (day: number) => cities[hopDays.filter((hop) => hop! <= day).length]!;
  const itineraryByCity =
    hopsValid &&
    activities.every((item) => item.day !== undefined && item.day >= 1 && item.day <= days) &&
    Array.from({ length: days }, (_, index) => index + 1).every((day) => {
      const transferIndex = hopDays.findIndex((hopDay) => hopDay === day);
      const transfer = transferIndex < 0 ? undefined : hops[transferIndex];
      const stops = activities.filter((item) => item.day === day);
      if (stops.length === 0) return false;
      if (!transfer) {
        const city = cityOfDay(day);
        return stops.every(
          (item) =>
            mentions(item, city) &&
            cities.every((other) => other === city || !mentions(item, other)),
        );
      }

      const departureCity = cities[transferIndex]!;
      const arrivalCity = cities[transferIndex + 1]!;
      if (!transfer.startTime || !transfer.endTime || transfer.startTime >= transfer.endTime)
        return false;
      return stops.every((item) => {
        if (!item.startTime || !item.endTime || item.startTime >= item.endTime) return false;
        const inDeparture =
          mentions(item, departureCity) &&
          cities.every((other) => other === departureCity || !mentions(item, other));
        if (inDeparture) return item.endTime <= transfer.startTime!;
        const inArrival =
          mentions(item, arrivalCity) &&
          cities.every((other) => other === arrivalCity || !mentions(item, other));
        return inArrival && item.startTime >= transfer.endTime!;
      });
    });

  const stays = cities.map((city) => {
    const hotels = itemsOf(plan, "accommodation").filter(
      (item) => item.kind === "hotel" && mentions(item, city),
    );
    if (hotels.length !== 1) return undefined;
    const detail = hotels[0]!.detail;
    const dates = detail.match(/(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/);
    const nights = detail.match(/\b(\d+) nights?\b/i);
    return dates && nights
      ? { checkIn: dates[1]!, checkOut: dates[2]!, nights: Number(nights[1]) }
      : undefined;
  });
  const stayNights = stays.every(
    (stay) =>
      stay !== undefined &&
      dayNumber(stay.checkOut) - dayNumber(stay.checkIn) === stay.nights &&
      stay.checkOut > stay.checkIn,
  );
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
  const stayDateRange = stays[0]?.checkIn === start && stays.at(-1)?.checkOut === end;

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
      id: "stay-nights",
      label: "Each stay's dates cover its stated number of nights",
      passed: stayNights,
    },
    {
      id: "stay-date-range",
      label: "The first and last stays match the trip's start and end dates",
      passed: stayDateRange,
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

export function evaluateAgentLabPlan(
  scenario: AgentLabScenario,
  plan: TripPlan,
): AgentLabEvaluation {
  const { rules, brief } = scenario;
  const proposals = plan.sections.flatMap((section) =>
    section.proposal ? [section.proposal] : [],
  );
  const items = proposals.flatMap((proposal) => proposal.items);

  const startsEarly = items.some(
    (item) =>
      item.kind === "activity" &&
      item.startTime !== undefined &&
      item.startTime < rules.earliestStartTime,
  );
  const meals = items.filter((item) => item.kind === "meal");
  const withinBudget = plan.estTotal <= plan.budgetTotal;

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

  if (rules.requiredMealEvidenceGroups) {
    checks.push({
      id: "meal-preference-tradeoff",
      label: "Each competing meal preference has fixture evidence",
      passed: rules.requiredMealEvidenceGroups.every((group) =>
        meals.some((meal) => group.some((term) => meal.detail.toLowerCase().includes(term))),
      ),
    });
  }

  if (rules.actionableBrief) {
    const activities = items.filter((item) => item.kind === "activity");
    const actionableActivities = activities.filter(
      (item) => item.day !== undefined && Boolean(item.startTime && item.location && item.detail),
    );
    checks.push({
      id: "actionable-brief",
      label: "The vague brief produces scheduled activities and local dining evidence",
      passed:
        actionableActivities.length >= rules.actionableBrief.minimumScheduledActivities &&
        rules.actionableBrief.requiredMealTerms.every((term) =>
          meals.some(
            (meal) =>
              meal.detail.toLowerCase().includes(term) &&
              Boolean(meal.location && meal.day !== undefined),
          ),
        ),
    });
  }

  if (rules.tripDays) {
    const activities = items.filter((item) => item.kind === "activity");
    checks.push({
      id: "trip-days",
      label: `Dated plan items fit the ${rules.tripDays}-day trip window`,
      passed:
        plan.brief.dates[0] === brief.dates[0] &&
        plan.brief.dates[1] === brief.dates[1] &&
        activities.length > 0 &&
        activities.every(
          (item) => item.day !== undefined && item.day >= 1 && item.day <= rules.tripDays!,
        ) &&
        items.every(
          (item) => item.day === undefined || (item.day >= 1 && item.day <= rules.tripDays!),
        ),
    });
    const nights = rules.tripDays - 1;
    const nightLabel = nights === 1 ? "night" : "nights";
    const hotel = items.find((item) => item.kind === "hotel");
    const stayDates = hotel?.detail.match(/(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/);
    checks.push({
      id: "stay-date-range",
      label: "Hotel check-in and check-out match the trip dates",
      passed:
        stayDates?.[1] === brief.dates[0] &&
        stayDates?.[2] === brief.dates[1] &&
        dayNumber(stayDates[2]!) - dayNumber(stayDates[1]!) === nights,
    });
    checks.push({
      id: "stay-nights",
      label: `Hotel evidence covers ${nights} ${nightLabel}`,
      passed:
        hotel !== undefined && new RegExp(`\\b${nights} ${nightLabel}\\b`, "i").test(hotel.detail),
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
