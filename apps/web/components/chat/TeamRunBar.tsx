"use client";
import { useLocale } from "@/components/account/LocaleProvider";
import { useTeamRun } from "./team-run";

export function TeamRunBar() {
  const { t } = useLocale();
  const { run, showLatest } = useTeamRun();
  if (!run) return null;
  return (
    <div className="team-run">
      <span className="team-run__turn">{t("Turn {n}", { n: run.turn })}</span>
      <button type="button" className="team-run__latest" onClick={showLatest}>
        {t("Latest turn")}
      </button>
    </div>
  );
}
