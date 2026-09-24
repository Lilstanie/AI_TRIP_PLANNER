import { BrandMark } from "./BrandMark";

// First paint while the client reads local history. Mirrors the workspace layout (sidebar,
// top bar, chat and map) so nothing shifts; there is no initial plan to wait for.
const HISTORY_WIDTHS = ["82%", "64%", "74%"];

export function WorkspaceSkeleton() {
  return (
    <div className="workspace-app" aria-busy="true">
      <aside className="workspace-sidebar" aria-hidden="true">
        <div className="sidebar-head">
          <BrandMark />
        </div>
        {HISTORY_WIDTHS.map((width) => (
          <div className="skeleton__section" key={width}>
            <div className="skeleton skeleton--line" style={{ width }} />
          </div>
        ))}
      </aside>
      <div className="workspace-main">
        <div className="workspace-topbar" aria-hidden="true">
          <div className="skeleton skeleton--line" style={{ width: 180 }} />
        </div>
        <main className="workspace-shell">
          <section className="workspace-panel workspace-panel--chat">
            <div className="panel chat">
              <p className="skeleton__status" role="status">
                Opening your workspace…
              </p>
            </div>
          </section>
          <section className="workspace-panel workspace-panel--map" aria-hidden="true">
            <div className="skeleton skeleton--map" />
          </section>
        </main>
      </div>
    </div>
  );
}
