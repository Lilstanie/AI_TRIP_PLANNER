import { planIssueCopy, type AgentName, type InterfaceLanguage } from "@trip/shared";

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

const chineseReason = (reason: string) =>
  planIssueCopy(reason, "zh", (name) => ROLE_NAMES.zh[name as AgentName] ?? name);

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
