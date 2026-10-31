import { RATES_AS_OF, type Currency } from "@trip/shared";
import { useLocale } from "./LocaleProvider";

export function CurrencyNotice({ currency: override }: { currency?: Currency }) {
  const { currency, t } = useLocale();
  if ((override ?? currency) === "AUD") return null;
  return (
    <small className="muted currency-notice">
      {t("approximateConvertedAmountsPlanningTotals").replace("{date}", RATES_AS_OF)}
    </small>
  );
}
