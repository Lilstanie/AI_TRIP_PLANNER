import { moneyDisplay } from "@/lib/money";

/**
 * Agent Lab amounts: fixed AUD in whole dollars (`A$3,960`), so strategies compare on one scale.
 * Agent Lab is English-only and ignores the workspace's display currency.
 */
export const labMoney = moneyDisplay({ currency: "AUD", locale: "en", whole: true, symbol: true });
