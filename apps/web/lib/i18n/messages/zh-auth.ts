import type { enAuth } from "./en-auth";

export const zhAuth: Record<keyof typeof enAuth, string> = {
  eyebrow: "你的旅行工作台",
  title: "好的旅行，从一次聊天开始。",
  description: "把几个想法变成属于你的行程。一起规划，在地图上看到每一站，随时接着上次继续。",
  benefitIdea: "说说你想去哪、想怎么玩",
  benefitShape: "边聊边调整行程",
  benefitDevices: "所有行程都在一起，任何设备都能打开",
  signIn: "登录",
  createAccount: "创建账号",
  loading: "正在加载登录…",
  loadFailed: "登录加载失败，请检查网络后重试。",
  tryAgain: "重试",
  passcode: "管理员口令",
  passcodeWrong: "口令不对。",
  passcodeSubmit: "用口令进入",
};
