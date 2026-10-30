/*
 * Adapted from DeepSeek Harness (https://github.com/deepseek-ai/deepseek-harness), commit 687f282e86.
 * Copyright (c) 2026 DeepSeek. Licensed under the MIT licence; see THIRD_PARTY_NOTICES.md.
 */

import type { ReactNode } from "react";
import { IconSparkleRegular, IconUserOutlineRegular } from "./shim";
import type { TrajectoryCellKind } from "./trajectory-record";
import type { TrajectoryKey } from "./locales";
import css from "./TrajectoryTable.module.css";

export const KIND_LABEL_KEY: Record<TrajectoryCellKind, TrajectoryKey> = {
  user: "kind.user",
  message: "kind.assistant",
  tool: "kind.tool",
  subtool: "kind.subtool",
};

function ToolWrenchIcon(): ReactNode {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-role-icon="wrench"
      aria-hidden="true"
    >
      <path d="M14 3.3a3.8 3.8 0 0 1-4.8 4.8l-5.1 5.1a1.6 1.6 0 1 1-2.3-2.3l5.1-5.1A3.8 3.8 0 0 1 11.7 1l-2.3 2.3 2.3 2.3L14 3.3Z" />
    </svg>
  );
}

export const KIND_ICON: Record<TrajectoryCellKind, ReactNode> = {
  user: <IconUserOutlineRegular size={13} />,
  message: <IconSparkleRegular size={13} />,
  tool: <ToolWrenchIcon />,
  subtool: <ToolWrenchIcon />,
};

export const KIND_TAG_CLASS: Record<TrajectoryCellKind, string> = {
  user: css.user ?? "",
  message: css.assistantVioletBright ?? "",
  tool: css.toolAmber ?? "",
  subtool: css.subtoolAmber ?? "",
};
