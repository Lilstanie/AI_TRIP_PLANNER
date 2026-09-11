"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "en" | "zh";

const ZH: Record<string, string> = {
  "Saved trips": "已保存行程",
  "My trips": "我的行程",
  "Trip filters": "行程筛选",
  "Agents plan against the confirmed values below.": "智能体将依据下方确认后的信息规划行程。",
  Destination: "目的地",
  Dates: "日期",
  Start: "开始",
  End: "结束",
  Travellers: "旅行人员",
  "Individual participants": "逐位参与者",
  "Add participant": "添加参与者",
  Label: "称呼",
  Self: "本人",
  Family: "家人",
  Friend: "朋友",
  Child: "儿童",
  Senior: "老人",
  "Agent budget": "智能体预算",
  "Display currency": "显示币种",
  Nationality: "国籍",
  "Optional passport nationality": "可选的护照国籍",
  "Apply filters and replan": "应用筛选并重新规划",
  "Updating plan…": "正在更新计划…",
  "Participant roles and display currency stay on this device until the shared contract is expanded.":
    "参与者身份和显示币种暂存在本设备，待共享契约扩展后再交给智能体。",
  "Agent cost calculations currently remain in whole-trip USD.":
    "智能体费用目前仍按整趟旅行的美元总价计算。",
  Filters: "筛选",
  Chat: "对话",
  Trip: "行程",
  Coordinator: "协调智能体",
  "Build your trip together": "一起规划你的旅程",
  "One conversation, with specialists working behind the scenes.":
    "由协调智能体统一沟通，专业智能体在后台协作。",
  "Tell me what to change, and I’ll ask the specialist agents to rebuild the plan.":
    "告诉我需要修改什么，我会让专业智能体重新规划。",
  Send: "发送",
  "Planning your trip…": "正在规划行程…",
  "Message the trip coordinator…": "向行程协调智能体发送消息…",
  "Agent activity": "智能体进度",
  Queued: "等待中",
  Running: "运行中",
  Complete: "已完成",
  "Needs attention": "需要处理",
  "Day plan": "每日行程",
  "Getting around": "交通",
  Stay: "住宿",
  "Destination guide": "目的地指南",
  "Food & dining": "餐饮",
  "AI-generated results may be inaccurate. Double-check important details.":
    "AI 生成结果可能不准确，请独立核对重要信息。",
  "Decision ledger": "决策记录",
  "Your trip plan": "你的旅行计划",
  "Total projected cost": "预计总费用",
  Budget: "预算",
  "On track": "预算正常",
  "Over budget": "超出预算",
  "under budget": "低于预算",
  "over budget": "超出预算",
  Planning: "规划中",
  Draft: "草案",
  "Needs you": "等待确认",
  Confirmed: "已确认",
  "Important notes": "重要提示",
  "Details are still being prepared.": "详细信息仍在生成。",
  "No detailed items were returned.": "智能体没有返回详细项目。",
  "Review in chat": "在对话中处理",
  "decisions need you": "项决策等待你确认",
  "No booking or payment is performed by this interface.": "本界面不会执行预订或付款。",
};

type LanguageContextValue = {
  language: Language;
  toggle: () => void;
  t: (text: string) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  toggle: () => undefined,
  t: (text) => text,
});

export function LanguageProvider({
  children,
  initialLanguage = "en",
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguage] = useState<Language>(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      toggle: () =>
        setLanguage((current) => {
          const next = current === "en" ? "zh" : "en";
          localStorage.setItem("ai-trip-planner.language", next);
          document.cookie = `ai-trip-planner-language=${next}; path=/; max-age=31536000; samesite=lax`;
          document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
          return next;
        }),
      t: (text) => (language === "zh" ? (ZH[text] ?? text) : text),
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
