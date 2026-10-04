"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import Image from "next/image";

/** The one brand asset; referenced by URL so its embedded image data is never duplicated. */
export const LOGO_SRC = "/brand/ai-trip-planner-logo.svg";

/**
 * Logo with an optional product name. When the name is visible the image is decorative;
 * when it is the only brand element (collapsed sidebar) it carries the product name.
 */
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
