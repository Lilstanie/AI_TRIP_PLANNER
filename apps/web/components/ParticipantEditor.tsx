"use client";

import { useLanguage } from "@/components/LanguageContext";

export type ParticipantKind = "self" | "family" | "friend" | "child" | "senior";
export type Participant = { id: string; label: string; kind: ParticipantKind };

export function createParticipants(count: number): Participant[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    id: index === 0 ? "self" : `participant-${index + 1}`,
    label: index === 0 ? "Me" : `Traveller ${index + 1}`,
    kind: index === 0 ? "self" : "friend",
  }));
}

export function ParticipantEditor({
  participants,
  onChange,
}: {
  participants: Participant[];
  onChange: (participants: Participant[]) => void;
}) {
  const { language, t } = useLanguage();
  const kinds: ParticipantKind[] = ["self", "family", "friend", "child", "senior"];

  return (
    <div className="participant-editor">
      <span className="subfield-title">{t("Individual participants")}</span>
      {participants.map((person, index) => (
        <div className="participant-row" key={person.id}>
          <input
            aria-label={`${t("Label")} ${index + 1}`}
            value={person.label}
            onChange={(event) =>
              onChange(
                participants.map((item) =>
                  item.id === person.id ? { ...item, label: event.target.value } : item,
                ),
              )
            }
          />
          <select
            aria-label={`${t("Individual participants")} ${index + 1}`}
            value={person.kind}
            onChange={(event) =>
              onChange(
                participants.map((item) =>
                  item.id === person.id
                    ? { ...item, kind: event.target.value as ParticipantKind }
                    : item,
                ),
              )
            }
          >
            {kinds.map((kind) => (
              <option value={kind} key={kind}>
                {t(kind[0]!.toUpperCase() + kind.slice(1))}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="remove-participant"
            aria-label={
              language === "zh" ? `移除 ${person.label}` : `Remove ${person.label || index + 1}`
            }
            disabled={participants.length === 1}
            onClick={() => onChange(participants.filter((item) => item.id !== person.id))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-button"
        onClick={() =>
          onChange([
            ...participants,
            {
              id: crypto.randomUUID(),
              label:
                language === "zh"
                  ? `同行者 ${participants.length + 1}`
                  : `Traveller ${participants.length + 1}`,
              kind: "friend",
            },
          ])
        }
      >
        + {t("Add participant")}
      </button>
    </div>
  );
}
