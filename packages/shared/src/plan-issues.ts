import type { InterfaceLanguage } from "./chat";

type Captures = string[];

interface IssueTemplate<P> {
  en: (params: P) => string;
  pattern: RegExp;
  zh: (captures: Captures, agentName: (name: string) => string) => string;
}

const template = <P>(issue: IssueTemplate<P>) => issue;

const ROUTE_PROBLEMS_ZH: Record<string, string> = {
  "no route returned": "没有查到路线",
  "invalid route duration, fare or mode": "路线的时长、票价或方式无效",
  "driving estimate cannot verify public transport timing": "驾车估算无法核实公共交通时间",
};
const routeProblemZh = (problem: string) => ROUTE_PROBLEMS_ZH[problem] ?? problem;

const ISSUES = {
  budgetInfeasible: template<{ floor: string; budget: string }>({
    en: ({ floor, budget }) =>
      `infeasible budget: the cheapest flights and stays found already cost ${floor}, above the ${budget} budget`,
    pattern:
      /infeasible budget: the cheapest flights and stays found already cost (.+?), above the (.+?) budget/,
    zh: ([floor, budget]) => `预算不够：已找到的最便宜航班和住宿就要 ${floor}，超过预算 ${budget}`,
  }),
  overBudget: template<{ percent: string; overrun: string }>({
    en: ({ percent, overrun }) => `plan is ${percent}% (${overrun}) over budget`,
    pattern: /plan is (.+?)% \((.+?)\) over budget/,
    zh: ([percent, overrun]) => `方案超出预算 ${percent}%（${overrun}）`,
  }),
  beforeArrival: template<{ day: number; arrivalDay: number; time: string }>({
    en: ({ day, arrivalDay, time }) =>
      `activity on day ${day} starts before the flight arrives on day ${arrivalDay} at ${time}`,
    pattern: /activity on day (\d+) starts before the flight arrives on day (\d+) at (\d\d:\d\d)/,
    zh: ([day, arrivalDay, time]) =>
      `第 ${day} 天的活动早于航班落地（第 ${arrivalDay} 天 ${time}）`,
  }),
  timeOverlap: template<{
    day: number;
    start: string;
    end: string;
    otherStart: string;
    otherEnd: string;
  }>({
    en: ({ day, start, end, otherStart, otherEnd }) =>
      `time overlap on day ${day}: ${start}-${end} conflicts with ${otherStart}-${otherEnd}`,
    pattern: /time overlap on day (\d+): (\S+?)-(\S+?) conflicts with (\S+?)-(\S+)/,
    zh: ([day, start, end, otherStart, otherEnd]) =>
      `第 ${day} 天时间冲突：${start}–${end} 与 ${otherStart}–${otherEnd} 重叠`,
  }),
  routeTiming: template<{ day: number; from: string; to: string; need: number; have: number }>({
    en: ({ day, from, to, need, have }) =>
      `geography conflict on day ${day}: ${from} to ${to} needs ${need} minutes including a 15-minute buffer but only ${have} are available`,
    pattern:
      /geography conflict on day (\d+): (.+?) to (.+?) needs (\d+) minutes including a 15-minute buffer but only (-?\d+) are available/,
    zh: ([day, from, to, need, have]) =>
      `第 ${day} 天从 ${from} 到 ${to} 需要 ${need} 分钟（含 15 分钟缓冲），但只有 ${have} 分钟`,
  }),
  routeFailed: template<{ day: number }>({
    en: ({ day }) =>
      `geography conflict on day ${day}: route provider failed; connection unverified`,
    pattern: /geography conflict on day (\d+): route provider failed; connection unverified/,
    zh: ([day]) => `第 ${day} 天路线服务出错，路程未能核实`,
  }),
  routeUnavailable: template<{ day: number; from: string; to: string }>({
    en: ({ day, from, to }) =>
      `geography conflict on day ${day}: route provider unavailable for ${from} → ${to}`,
    pattern: /geography conflict on day (\d+): route provider unavailable for (.+?) → (.+?)/,
    zh: ([day, from, to]) => `第 ${day} 天路线服务不可用，无法核实 ${from} → ${to}`,
  }),
  stopRouteProblem: template<{ day: number; from: string; to: string; problem: string }>({
    en: ({ day, from, to, problem }) =>
      `geography conflict on day ${day}: ${from} to ${to}: ${problem}`,
    pattern: /geography conflict on day (\d+): (.+?) to (.+?): (.+?)/,
    zh: ([day, from, to, problem]) =>
      `第 ${day} 天从 ${from} 到 ${to}：${routeProblemZh(problem!)}`,
  }),
  hopRouteProblem: template<{ day: number; from: string; to: string; problem: string }>({
    en: ({ day, from, to, problem }) =>
      `geography conflict on day ${day}: ${from} → ${to}: ${problem}`,
    pattern: /geography conflict on day (\d+): (.+?) → (.+?): (.+?)/,
    zh: ([day, from, to, problem]) => `第 ${day} 天 ${from} → ${to}：${routeProblemZh(problem!)}`,
  }),
  overnightCity: template<{ day: number }>({
    en: ({ day }) =>
      `geography conflict: day ${day} transport does not end in the selected overnight city; activities were omitted`,
    pattern:
      /geography conflict: day (\d+) transport does not end in the selected overnight city; activities were omitted/,
    zh: ([day]) => `第 ${day} 天的交通没有到达当晚住宿的城市，已省略当天活动`,
  }),
  noGroundedPlaces: template<Record<string, never>>({
    en: () => "geography conflict: no grounded places available; itinerary requires new evidence",
    pattern: /geography conflict: no grounded places available; itinerary requires new evidence/,
    zh: () => "没有可核实的地点，日程需要新的地点信息",
  }),
  flightUnavailable: template<{ from: string; to: string }>({
    en: ({ from, to }) =>
      `Flight provider unavailable; required flight ${from} → ${to} remains unpriced.`,
    pattern: /Flight provider unavailable; required flight (.+?) → (.+?) remains unpriced\./,
    zh: ([from, to]) => `航班服务不可用，${from} → ${to} 的必需航班还没有价格`,
  }),
  flightNoFare: template<{ from: string; to: string }>({
    en: ({ from, to }) =>
      `Required flight ${from} → ${to} has no valid fare; transport estimate is incomplete.`,
    pattern: /Required flight (.+?) → (.+?) has no valid fare; transport estimate is incomplete\./,
    zh: ([from, to]) => `${from} → ${to} 的必需航班没有有效票价，交通估算不完整`,
  }),
  hopTooLong: template<{ day: number; from: string; to: string; mode: string }>({
    en: ({ day, from, to, mode }) =>
      `time conflict on day ${day}: ${from} → ${to} by ${mode} cannot fit inside one planning day`,
    pattern:
      /time conflict on day (\d+): (.+?) → (.+?) by (.+?) cannot fit inside one planning day/,
    zh: ([day, from, to, mode]) => `第 ${day} 天 ${from} → ${to}（${mode}）在一天内安排不下`,
  }),
  routeTooLong: template<{ day: number }>({
    en: ({ day }) => `time conflict on day ${day}: route cannot fit inside one planning day`,
    pattern: /time conflict on day (\d+): route cannot fit inside one planning day/,
    zh: ([day]) => `第 ${day} 天的路线在一天内安排不下`,
  }),
  noDaytimeSlot: template<{ day: number }>({
    en: ({ day }) => `time conflict on day ${day}: requested clear window leaves no daytime slot`,
    pattern: /time conflict on day (\d+): requested clear window leaves no daytime slot/,
    zh: ([day]) => `第 ${day} 天要求空出的时段占满了白天`,
  }),
  makeRouteFeasible: template<Record<string, never>>({
    en: () => "make the route geographically feasible",
    pattern: /make the route geographically feasible/,
    zh: () => "让路线在地理上走得通",
  }),
  cutCost: template<{ agent: string; saving: string; limit: string }>({
    en: ({ agent, saving, limit }) => `cut ${agent} cost by ${saving}, to at most ${limit}`,
    pattern: /cut (\S+) cost by (.+?), to at most (.+?)/,
    zh: ([agent, saving, limit], agentName) =>
      `${agentName(agent!)}费用减少 ${saving}，最多 ${limit}`,
  }),
  afterArrival: template<{ day: number; time: string }>({
    en: ({ day, time }) => `schedule destination activities after arrival on day ${day} at ${time}`,
    pattern: /schedule destination activities after arrival on day (\d+) at (\d\d:\d\d)/,
    zh: ([day, time]) => `第 ${day} 天 ${time} 落地后再安排目的地活动`,
  }),
  keepClear: template<{ day: number; start: string; end: string; agent: string; place?: string }>({
    en: ({ day, start, end, agent, place }) =>
      `on day ${day} keep clear of ${start}-${end}, held by ${agent}${place ? ` (${place})` : ""}; reschedule without changing trip dates`,
    pattern:
      /on day (\d+) keep clear of (\d\d:\d\d)-(\d\d:\d\d), held by (\S+?)(?: \((.+)\))?; reschedule without changing trip dates/,
    zh: ([day, start, end, agent, place], agentName) =>
      `第 ${day} 天避开 ${start}–${end}（${agentName(agent!)}${place ? `：${place}` : ""}已占用），不改行程日期重新安排`,
  }),
  raiseBudget: template<{ floor: string }>({
    en: ({ floor }) =>
      `raise the budget to at least ${floor} (from the options found, before activities and meals), or change dates, origin or destination`,
    pattern:
      /raise the budget to at least (.+?) \(from the options found, before activities and meals\), or change dates, origin or destination/,
    zh: ([floor]) =>
      `把预算提高到至少 ${floor}（按已找到的选项，不含活动和餐饮），或者改日期、出发地或目的地`,
  }),
};

export type PlanIssueKind = keyof typeof ISSUES;

type IssueParams<K extends PlanIssueKind> = Parameters<(typeof ISSUES)[K]["en"]>[0];

export function planIssue<K extends PlanIssueKind>(kind: K, params: IssueParams<K>): string {
  return (ISSUES[kind].en as (value: IssueParams<K>) => string)(params);
}

const MATCHERS = Object.values(ISSUES).map((issue) => ({
  pattern: new RegExp(`^(?:${issue.pattern.source})(?=; |$)`),
  zh: issue.zh as IssueTemplate<unknown>["zh"],
}));

export function planIssueCopy(
  text: string,
  language: InterfaceLanguage | undefined,
  agentName: (name: string) => string = (name) => name,
): string {
  if (language !== "zh") return text;
  const parts: string[] = [];
  let rest = text;
  while (rest) {
    const matched = MATCHERS.map(({ pattern, zh }) => ({ match: pattern.exec(rest), zh })).find(
      ({ match }) => match,
    );
    if (matched?.match) {
      parts.push(matched.zh(matched.match.slice(1), agentName));
      rest = rest.slice(matched.match[0].length);
    } else {
      const end = rest.indexOf("; ");
      parts.push(end < 0 ? rest : rest.slice(0, end));
      rest = end < 0 ? "" : rest.slice(end);
    }
    if (rest.startsWith("; ")) rest = rest.slice(2);
  }
  return parts.join("；");
}
