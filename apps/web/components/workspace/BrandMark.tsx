"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import Image from "next/image";

export const LOGO_SRC = "/brand/ai-trip-planner-logo.svg";

export function BrandMark({ showName = true }: { showName?: boolean }) {
  const { t } = useLocale();
  return (
    <span className="brand-mark">
      <Image
        className="brand-mark__logo"
        src={LOGO_SRC}
        alt={showName ? "" : "AI Trip Planner"}
        width={32}
        height={32}
        unoptimized
        priority
      />
      {showName && <span className="brand-mark__name">{t("AI Trip Planner")}</span>}
    </span>
  );
}
