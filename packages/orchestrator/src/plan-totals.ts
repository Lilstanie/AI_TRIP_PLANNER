// The roll-up and conflict check every plan edit ends with. Exported on their own (`@trip/orchestrator/plan-totals`)
// because the workspace's browser code runs the same calculation for edits it makes without the server; the package
// root pulls in the agent graph, which must not reach the browser.
export { detectConflicts } from "./conflicts";
export { rollUpCost } from "./budget";
