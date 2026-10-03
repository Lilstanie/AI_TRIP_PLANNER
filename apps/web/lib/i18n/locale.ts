export const LOCALES = ["en", "zh-CN"] as const;
export type AppLocale = (typeof LOCALES)[number];

export const DISPLAY_CURRENCIES = ["AUD", "USD", "CNY", "destination"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export type CurrencyCode =
  | "AUD"
  | "USD"
  | "CNY"
  | "JPY"
  | "EUR"
  | "GBP"
  | "NZD"
  | "CAD"
  | "SGD"
  | "KRW"
  | "THB"
  | "IDR"
  | "INR"
  | "VND"
  | "MYR"
  | "CHF"
  | "HKD";

export const DISPLAY_RATES_AS_OF = "2026-09-20";

/**
 * Approximate AUD value of one unit. The planner stores and checks every total in AUD; these
 * rounded rates only change what the traveller sees and types. They are planning estimates, not
 * live foreign-exchange quotes.
 */
export const AUD_PER_DISPLAY_CURRENCY: Record<CurrencyCode, number> = {
  AUD: 1,
  USD: 1.5,
  CNY: 0.21,
  JPY: 0.01,
  EUR: 1.63,
  GBP: 1.9,
  NZD: 0.91,
  CAD: 1.1,
  SGD: 1.16,
  KRW: 0.0011,
  THB: 0.046,
  IDR: 0.000092,
  INR: 0.018,
  VND: 0.000059,
  MYR: 0.35,
  CHF: 1.83,
  HKD: 0.19,
};

const DESTINATION_CURRENCIES: readonly [RegExp, CurrencyCode][] = [
  [/japan|tokyo|kyoto|osaka|日本|东京|東京|京都|大阪/i, "JPY"],
  [/china|beijing|shanghai|guangzhou|中国|北京|上海|广州|廣州/i, "CNY"],
  [/united states|usa|new york|los angeles|美国|美國|纽约|紐約|洛杉矶/i, "USD"],
  [/australia|sydney|melbourne|brisbane|perth|澳大利亚|澳洲|悉尼|墨尔本/i, "AUD"],
  [/new zealand|auckland|queenstown|新西兰|奥克兰|皇后镇/i, "NZD"],
  [/united kingdom|england|london|scotland|英国|英國|伦敦|倫敦/i, "GBP"],
  [
    /france|germany|italy|spain|portugal|netherlands|paris|rome|lisbon|europe|法国|德国|意大利|西班牙|欧洲|巴黎|罗马/i,
    "EUR",
  ],
  [/canada|toronto|vancouver|加拿大|多伦多|温哥华/i, "CAD"],
  [/singapore|新加坡/i, "SGD"],
  [/south korea|korea|seoul|韩国|韓國|首尔|首爾/i, "KRW"],
  [/thailand|bangkok|phuket|泰国|泰國|曼谷|普吉/i, "THB"],
  [/indonesia|bali|jakarta|印度尼西亚|印尼|巴厘岛|峇里島/i, "IDR"],
  [/india|delhi|mumbai|印度|德里|孟买|孟買/i, "INR"],
  [/vietnam|hanoi|ho chi minh|越南|河内|河內|胡志明/i, "VND"],
  [/malaysia|kuala lumpur|马来西亚|馬來西亞|吉隆坡/i, "MYR"],
  [/switzerland|zurich|瑞士|苏黎世|蘇黎世/i, "CHF"],
  [/hong kong|香港/i, "HKD"],
];

export function destinationCurrency(destination: string): CurrencyCode | undefined {
  return DESTINATION_CURRENCIES.find(([pattern]) => pattern.test(destination))?.[1];
}

export function resolveDisplayCurrency(
  preference: DisplayCurrency,
  destination = "",
): CurrencyCode {
  return preference === "destination" ? (destinationCurrency(destination) ?? "AUD") : preference;
}

export function audToDisplay(amount: number, currency: CurrencyCode): number {
  return amount / AUD_PER_DISPLAY_CURRENCY[currency];
}

export function displayToAud(amount: number, currency: CurrencyCode): number {
  return amount * AUD_PER_DISPLAY_CURRENCY[currency];
}

export function formatAudForDisplay(
  amount: number,
  currency: CurrencyCode,
  locale: AppLocale,
  maximumFractionDigits = 2,
  minimumFractionDigits = currency === "JPY" || currency === "KRW" || currency === "VND" ? 0 : 2,
): string {
  return new Intl.NumberFormat(locale === "zh-CN" ? "zh-CN" : "en-AU", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(audToDisplay(amount, currency));
}

const ZH: Record<string, string> = {
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
  "Display currency": "显示币种",
  "Australian dollar (AUD)": "澳元（AUD）",
  "US dollar (USD)": "美元（USD）",
  "Chinese yuan (CNY)": "人民币（CNY）",
  "Destination currency": "目的地当地币种",
  "Totals stay in AUD for planning. Display conversions are approximate and are not live exchange-rate quotes.":
    "规划与预算校验仍以澳元进行。显示换算为估算值，并非实时外汇报价。",
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
  "For the whole group and the whole trip.": "请输入整个团队整趟旅行的总预算。",
  Adults: "成人",
  Children: "儿童",
  Infants: "婴儿",
  Seniors: "老人",
  Pets: "宠物",
  "Suburb (optional)": "城区（选填）",
  "City *": "城市 *",
  "State / province (optional)": "州／省（选填）",
  "Country *": "国家 *",
  "e.g. Sydney": "例如：悉尼",
  "e.g. Australia": "例如：澳大利亚",
  Optional: "选填",
  "Get current location": "获取当前位置",
  "Locating…": "正在定位…",
  "Remove destination": "移除目的地",
  "City and country are required for every destination and your departure address.":
    "每个目的地及出发地都需填写城市和国家。",
  "Only when you click: your coordinates are sent to OpenStreetMap to fill this address.":
    "仅点击定位后，才将坐标发送至 OpenStreetMap 填写地址。",
  "Enter a city and country for each destination and your departure address.":
    "请填写每个目的地及出发地的城市和国家。",
  "Location is unavailable. Enter your address manually.": "暂时无法定位，请手动填写地址。",
  "Location permission denied. Enter your address manually.": "定位权限被拒绝，请手动填写地址。",
  "Unable to find your address. Enter it manually.": "无法查询地址，请手动填写。",
  "Location filled in. Check the city and country before saving.":
    "地址已填入，保存前请核对城市和国家。",
  "Up to 9 travellers in total and 3 pets. Pets do not count as travellers.":
    "同行人员合计最多 9 人，宠物最多 3 个。宠物不计入人数。",
  "Trips support at most 9 travellers.": "同行人员合计最多 9 人。",
  "Trips support at most 3 pets.": "宠物最多 3 个。",
  "Enter a whole number of travellers, 1 or more.": "请填写至少 1 人的整数人数。",
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
};

export function translate(locale: AppLocale, text: string): string {
  return locale === "zh-CN" ? (ZH[text] ?? text) : text;
}
