import type { enFares } from "./en-fares";

export const zhFares: Record<keyof typeof enFares, string> = {
  low: "价格偏低",
  typical: "价格正常",
  high: "价格偏高",
  usual: "常见 {range}",
  trend: "近 {count} 天价格走势",
};
