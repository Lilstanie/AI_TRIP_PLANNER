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
  objective: (section: string) => `Produce the ${section} section for this trip.`,
  fix: (reason: string) => `Fix: ${reason}`,
  produced: (agent: string) => `Produced ${agent} section.`,
  revised: (agent: string, reason: string) => `Revised ${agent} after: ${reason}.`,
  mentioned: (labels: string[]) => `Asking ${labels.join(" and ")} to handle your request.`,
};

const CHINESE: typeof ENGLISH = {
  planningTasks: (destination) => `正在为${destination}分配规划任务。`,
  brief: ({ destination, start, end, groupSize, money }) =>
    `${destination} · ${start} 至 ${end} · ${groupSize} 人 · ${money}`,
  checked: (count) => `已检查预算和时间安排：${count} 条修改请求。`,
  revising: "正在修改受影响的部分。",
  notImproved: "修改没有改善方案，保留之前的版本。",
  assembling: "正在整理方案。",
  objective: (section) => `为本次行程生成${section}部分。`,
  fix: (reason) => `修正：${reason}`,
  produced: (agent) => `已生成${agent}部分。`,
  revised: (agent, reason) => `根据“${reason}”修改了${agent}部分。`,
  mentioned: (labels) => `请${labels.join("和")}处理你的请求。`,
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
    itinerary: "每日行程",
    transport: "出行交通",
    accommodation: "住宿",
    "destination-guide": "目的地指南",
    dining: "餐饮",
  },
};
