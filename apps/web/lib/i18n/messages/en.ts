import { enShell } from "./en-shell";
import { enWorkspace } from "./en-workspace";

export const en = { ...enWorkspace, ...enShell } as const;
