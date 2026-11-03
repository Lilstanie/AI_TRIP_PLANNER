import type { AgentName, InterfaceLanguage } from "@trip/shared";

interface BriefLine {
  destination: string;
  start: string;
  end: string;
  groupSize: number;
  money: string;
}

const ENGLISH = {
  planningTasks: (destination: string) => `Assigning planning tasks for ${destination}.`,
  brief: ({ destination, start, end, groupSize, money }: BriefLine) =>
    `${destination} · ${start} to ${end} · ${groupSize} people · ${money}`,
  checked: (count: number) =>
    `Checked budget and schedules: ${count} revision ${count === 1 ? "request" : "requests"}.`,
  revising: "Revising affected sections.",
  notImproved: "Revision did not improve the plan; keeping the previous version.",
  assembling: "Assembling the plan.",
  objective: (agent: AgentName) => `Produce the ${ROLE_NAMES.en[agent]} section for this trip.`,
  fix: (reason: string) => `Fix: ${reason}`,
  produced: (agent: AgentName) => `Produced ${ROLE_NAMES.en[agent]} section.`,
  revised: (agent: AgentName) => `Revised the ${ROLE_NAMES.en[agent]} section.`,
  mentioned: (labels: string[]) => `Asking ${labels.join(" and ")} to handle your request.`,
  flightTitle: (from: string, to: string) => `Flight ${from} → ${to}`,
  stayTitle: (city: string) => `Stay in ${city}`,
  total: (money: string) => `${money} total`,
  nonstop: "Nonstop",
  stops: (count: number) => `${count} stop${count === 1 ? "" : "s"}`,
  duration: (hours: number, minutes: number) => `${hours}h ${minutes}m`,
  cancellationUnknown: "Cancellation terms unknown",
  freeCancellation: "Free cancellation",
  noFreeCancellation: "No free cancellation",
};

const CHINESE_REASONS: ReadonlyArray<readonly [RegExp, (match: RegExpExecArray) => string]> = [
  [
    /^geography conflict on day (\d+): (.+) to (.+) needs (\d+) minutes including a 15-minute buffer but only (-?\d+) are available$/,
    ([, day, from, to, need, have]) =>
      `第 ${day} 天从 ${from} 到 ${to} 需要 ${need} 分钟（含 15 分钟缓冲），但只有 ${have} 分钟`,
  ],
  [
    /^geography conflict on day (\d+): route provider failed$/,
    ([, day]) => `第 ${day} 天路线服务出错`,
  ],
  [/^connection unverified$/, () => "路程未能核实"],
  [
    /^geography conflict on day (\d+): route provider unavailable for (.+)$/,
    ([, day, leg]) => `第 ${day} 天路线服务不可用，无法核实 ${leg}`,
  ],
  [
    /^geography conflict: day (\d+) transport does not end in the selected overnight city$/,
    ([, day]) => `第 ${day} 天的交通没有到达当晚住宿的城市`,
  ],
  [/^activities were omitted$/, () => "已省略当天活动"],
  [/^geography conflict: no grounded places available$/, () => "没有可核实的地点"],
  [/^itinerary requires new evidence$/, () => "日程需要新的地点信息"],
  [
    /^infeasible budget: the cheapest flights and stays found already cost (.+), above the (.+) budget$/,
    ([, floor, budget]) => `预算不够：已找到的最便宜航班和住宿就要 ${floor}，超过预算 ${budget}`,
  ],
  [/^plan is (.+)% \((.+)\) over budget$/, ([, pct, money]) => `方案超出预算 ${pct}%（${money}）`],
  [
    /^activity on day (\d+) starts before the flight arrives on day (\d+) at (\d\d:\d\d)$/,
    ([, day, arrival, time]) => `第 ${day} 天的活动早于航班落地（第 ${arrival} 天 ${time}）`,
  ],
  [
    /^time overlap on day (\d+): (\S+)-(\S+) conflicts with (\S+)-(\S+)$/,
    ([, day, a, b, c, d]) => `第 ${day} 天时间冲突：${a}–${b} 与 ${c}–${d} 重叠`,
  ],
];

function chineseReason(reason: string): string {
  return reason
    .split("; ")
    .map((part) => {
      for (const [pattern, write] of CHINESE_REASONS) {
        const match = pattern.exec(part);
        if (match) return write(match);
      }
      return part;
    })
    .join("；");
}

const CHINESE: typeof ENGLISH = {
  planningTasks: (destination) => `正在为${destination}分配规划任务。`,
  brief: ({ destination, start, end, groupSize, money }) =>
    `${destination} · ${start} 至 ${end} · ${groupSize} 人 · ${money}`,
  checked: (count) => `已检查预算和时间安排：${count} 条修改请求。`,
  revising: "正在修改受影响的部分。",
  notImproved: "修改没有改善方案，保留之前的版本。",
  assembling: "正在整理方案。",
  objective: (agent) => `为本次行程生成「${ROLE_NAMES.zh[agent]}」部分。`,
  fix: (reason) => `修正：${chineseReason(reason)}`,
  produced: (agent) => `已生成「${ROLE_NAMES.zh[agent]}」部分。`,
  revised: (agent) => `已修改「${ROLE_NAMES.zh[agent]}」部分。`,
  mentioned: (labels) => `请${labels.join("和")}处理你的请求。`,
  flightTitle: (from, to) => `航班 ${from} → ${to}`,
  stayTitle: (city) => `${city}住宿`,
  total: (money) => `共 ${money}`,
  nonstop: "直飞",
  stops: (count) => `经停 ${count} 次`,
  duration: (hours, minutes) => `${hours} 小时 ${minutes} 分`,
  cancellationUnknown: "取消政策未知",
  freeCancellation: "可免费取消",
  noFreeCancellation: "不可免费取消",
};

export function progressCopy(language: InterfaceLanguage | undefined): typeof ENGLISH {
  return language === "zh" ? CHINESE : ENGLISH;
}

export const ROLE_NAMES: Record<InterfaceLanguage, Record<AgentName, string>> = {
  en: {
    itinerary: "Day plan",
    transport: "Getting around",
    accommodation: "Stay",
    "destination-guide": "Destination guide",
    dining: "Food & dining",
  },
  zh: {
    itinerary: "日程规划",
    transport: "交通出行",
    accommodation: "住宿",
    "destination-guide": "目的地指南",
    dining: "美食餐饮",
  },
};
