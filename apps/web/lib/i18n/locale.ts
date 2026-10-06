import { fromAud, type Currency } from "@trip/shared";

import { PHONE_ZH } from "./phone-messages";
import { WORKSPACE_ZH } from "./workspace-messages";

export const LOCALES = ["en", "zh"] as const;
export type AppLocale = (typeof LOCALES)[number];
export type CurrencyCode = Currency;

/** With no saved choice the interface follows the browser: any `zh*` language means Chinese. */
export function browserLocale(languages: readonly string[]): AppLocale {
  return languages[0]?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

/** The BCP 47 tag for `<html lang>` and `Intl` formatters. */
export const intlLocale = (locale: AppLocale) => (locale === "zh" ? "zh-CN" : "en-AU");

/**
 * Decimal places shown for a currency, from its ISO 4217 minor unit: `JPY` and `KRW` have none,
 * `AUD` has two. An unknown code keeps two.
 */
export function currencyDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/**
 * A provider-native amount (such as a transit fare) in its own currency, never converted:
 * `JPY 230`, `AUD 12.50`.
 */
export const formatProviderAmount = ({ amount, currency }: { amount: number; currency: string }) =>
  `${currency} ${amount.toFixed(currencyDigits(currency))}`;

/** One formatter for AUD planning amounts; source amounts can be displayed without a round trip. */
export function formatAudForDisplay(
  amount: number,
  currency: CurrencyCode,
  locale: AppLocale,
  maximumFractionDigits = currencyDigits(currency),
  minimumFractionDigits = currencyDigits(currency),
  source?: { amount: number; currency: Currency },
): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(source?.currency === currency ? source.amount : fromAud(amount, currency));
}

const ZH = {
  ...WORKSPACE_ZH,
  ...PHONE_ZH,
  "Edit profile": "编辑个人资料",
  "Your account": "你的账户",
  Personalization: "个性化",
  "Language & region": "语言与地区",
  "Connected accounts": "已连接账户",
  Language: "语言",
  English: "English",
  "Simplified Chinese": "简体中文",
  Region: "地区",
  Australia: "澳大利亚",
  Advanced: "高级设置",
  Currency: "货币",
  "Display currency": "显示币种",
  "Approximate converted amounts; planning totals stay in AUD. Rates as of {date}.":
    "换算金额仅供估算；规划总额仍使用 AUD。汇率参考日期：{date}。",
  Units: "单位",
  "Metric (°C, km)": "公制（°C、公里）",
  "Trip data": "行程数据",
  "Settings sections": "设置栏目",
  Change: "更改",
  Close: "关闭",
  Done: "完成",
  Chats: "聊天",
  Trips: "行程",
  Settings: "设置",
  "Chats and trips": "聊天和行程",
  Workspace: "工作区",
  "Expand sidebar": "展开侧边栏",
  "Collapse sidebar": "收起侧边栏",
  "Open account menu": "打开账户菜单",
  "Account settings": "账户设置",
  Local: "本地",
  "Saved in this browser": "保存在此浏览器中",
  "Saved locally": "已保存到本地",
  "New trip": "新行程",
  Where: "去哪里",
  When: "日期",
  Who: "同行人员",
  Budget: "预算",
  Preferences: "旅行偏好",
  "Trip preferences": "旅行偏好",
  Destination: "目的地",
  Dates: "日期",
  Travellers: "旅行人员",
  "Trip details": "行程信息",
  "Open trip preferences": "打开旅行偏好",
  "Add a destination": "添加目的地",
  "Add destination": "添加目的地",
  Destinations: "目的地",
  "City or region": "城市或地区",
  "Departing from": "出发地",
  "(optional)": "（可选）",
  "Your home city": "你的常住城市",
  "Leave blank to plan the destination only, without long-haul flights.":
    "留空则只规划目的地内的行程，不包含长途航班。",
  Save: "保存",
  "Update trip": "更新行程",
  "Plan trip": "规划行程",
  "Planning…": "正在规划…",
  "Budget range": "预算范围",
  "Or enter an amount": "输入金额",
  "For the whole group and the whole trip, in {currency}.":
    "请输入整个团队整趟旅行的总预算，币种为 {currency}。",
  "For the whole group and the whole trip.": "请输入整个团队整趟旅行的总预算。",
  Adults: "成人",
  Children: "儿童",
  Infants: "婴儿",
  Seniors: "老人",
  Pets: "宠物",
  "Ages 13–64": "13–64 岁",
  "Ages 2–12": "2–12 岁",
  "Under 2": "2 岁以下",
  Clear: "清除",
  "Choose your travel dates.": "选择旅行日期。",
  Chat: "聊天",
  Map: "地图",
  Trip: "行程",
  Navigation: "导航",
  "Close navigation": "关闭导航",
  "Open navigation": "打开导航",
  "Workspace view": "工作区视图",
  "Open your trip": "打开你的行程",
  stop: "站点",
  stops: "站点",
  "Save failed": "保存失败",
  "Saving…": "正在保存…",
  "Synced to your account": "已同步到账户",
  "Saved here · sync paused": "已保存在此处 · 同步已暂停",
  "Where to next?": "下一站去哪里？",
  "Describe your destination, travel dates, number of travellers and total budget, or add them in the bar at the top.":
    "告诉我目的地、旅行日期、人数和总预算，或在顶部栏逐项填写。",
  "Example trips": "示例行程",
  "Pick an example to plan it now, or write your own below.":
    "选择一个示例立即规划，或在下方输入你的需求。",
  "Add trip details": "添加行程信息",
  "Thinking process": "思考过程",
  "Tell me what to change…": "告诉我需要修改什么…",
  "Destination, dates, travellers and budget…": "目的地、日期、旅行人员和预算…",
  "Estimates require verification. Nothing here makes a booking.":
    "所有估算都需要核实；本页面不会自动完成预订。",
  "Attached files": "已附加文件",
  "Message AI Trip Planner": "向 AI 旅行规划助手发送消息",
  "Upload files": "上传文件",
  "Add files": "添加文件",
  "Stop planning": "停止规划",
  Send: "发送",
  "Show where you are on the map?": "要在地图上显示你的位置吗？",
  "Your location is used only to show you on the map and for routes you ask for. It is not saved.":
    "你的位置仅用于在地图上显示当前位置和规划路线，不会被保存。",
  "Allow location": "允许定位",
  "Not now": "暂不",
  "Live data": "实时数据",
  "Mock data": "示例数据",
  "Data and language controls": "数据与语言控制",
  "Trip map": "行程地图",
  "Your map will appear here": "地图将在这里显示",
  "Tell us a destination and dates in the chat, or add them in the bar at the top.":
    "在聊天中告诉我们目的地和日期，或在顶部栏中添加。",
  "Sign in": "登录",
  Account: "账户",
  "Keep your trips in sync": "登录后在各设备间同步行程",
  "Checking account…": "正在检查账户…",
  "Your travel workspace": "你的旅行工作区",
  "View profile": "查看个人资料",
  "Sign out": "退出登录",
  "Account and settings": "账户与设置",
  "Saved in this browser.": "已保存在此浏览器中。",
  "Saving to your account…": "正在保存到你的账户…",
  "Saved to your account.": "已保存到你的账户。",
  "Could not reach your account; saved in this browser and will retry.":
    "暂时无法连接你的账户；已保存在此浏览器中，稍后会重试。",
  "65+": "65 岁及以上",
  "Budget|tier": "经济",
  Moderate: "适中",
  Comfort: "舒适",
  Luxury: "豪华",
  Manage: "管理",
  Export: "导出",
} as const satisfies Record<string, string>;

/** An English interface string that has a Chinese entry; `t()` accepts nothing else. */
export type MessageKey = keyof typeof ZH;

/**
 * English is the key itself, so a missing or empty Chinese entry falls back to English. A key may
 * carry a `|context` suffix when one English word needs two translations ("Budget|tier"); English
 * shows only the part before it.
 */
export function translate(
  locale: AppLocale,
  text: MessageKey,
  params: Record<string, string | number> = {},
): string {
  const zh = locale === "zh" ? (ZH as Record<string, string>)[text] : undefined;
  let result = zh || text.split("|")[0]!;
  for (const [key, value] of Object.entries(params))
    result = result.replaceAll(`{${key}}`, String(value));
  return result;
}

/**
 * Authored notices that carry a value and are still built as English. Each pattern matches the
 * English the app builds, and its capture groups fill the named placeholders of the dictionary key
 * in order. A producer converted to a keyed `Notice` (see `notice.ts`) loses its entry here.
 */
const NOTICE_PATTERNS: readonly [RegExp, MessageKey, readonly string[]][] = [
  [/^Request failed \((\d{3})\)\.$/, "Request failed ({status}).", ["status"]],
];

/** Recognized authored notices only; unrecognized provider errors pass through unchanged. */
export function interfaceNotice(locale: AppLocale, text: string): string {
  if (Object.hasOwn(ZH, text)) return translate(locale, text as MessageKey);
  for (const [pattern, key, names] of NOTICE_PATTERNS) {
    const match = pattern.exec(text);
    if (match)
      return translate(
        locale,
        key,
        Object.fromEntries(names.map((name, index) => [name, match[index + 1]!])),
      );
  }
  return text;
}
