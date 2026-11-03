import { AGENT_NAMES, type AgentName } from "@trip/shared";
import { translate, type AppLocale } from "@/lib/i18n/locale";
import { labels } from "./thinking-model";

const agent = (name: string) =>
  (AGENT_NAMES as readonly string[]).includes(name)
    ? translate("zh", labels[name as AgentName])
    : name;

const ZH: ReadonlyArray<readonly [RegExp, (match: RegExpExecArray) => string]> = [
  [/^make the route geographically feasible$/, () => "让路线在地理上走得通"],
  [
    /^cut (\S+) cost by (.+), to at most (.+)$/,
    ([, name, cut, limit]) => `${agent(name!)}费用减少 ${cut}，最多 ${limit}`,
  ],
  [
    /^schedule destination activities after arrival on day (\d+) at (\d\d:\d\d)$/,
    ([, day, time]) => `第 ${day} 天 ${time} 落地后再安排目的地活动`,
  ],
  [
    /^on day (\d+) keep clear of (\d\d:\d\d)-(\d\d:\d\d), held by (\S+?)(?: \((.+)\))?; reschedule without changing trip dates$/,
    ([, day, from, to, name, place]) =>
      `第 ${day} 天避开 ${from}–${to}（${agent(name!)}${place ? `：${place}` : ""}已占用），不改行程日期重新安排`,
  ],
  [
    /^raise the budget to at least (.+?) \(from the options found, before activities and meals\), or change dates, origin or destination$/,
    ([, floor]) =>
      `把预算提高到至少 ${floor}（按已找到的选项，不含活动和餐饮），或者改日期、出发地或目的地`,
  ],
];

export function constraintCopy(constraint: string, locale: AppLocale): string {
  if (locale !== "zh") return constraint;
  for (const [pattern, write] of ZH) {
    const match = pattern.exec(constraint);
    if (match) return write(match);
  }
  return constraint;
}
