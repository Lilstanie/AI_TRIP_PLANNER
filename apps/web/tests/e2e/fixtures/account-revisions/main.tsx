import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useAccountSync } from "@/components/account/useAccountSync";
import { SettingsProvider, useSettings } from "@/components/account/SettingsProvider";
import { createCatalog, parseCatalog } from "@/lib/workspace/catalog";
import { snapshot } from "../../../fixtures/workspace";

function Workspace() {
  const [catalog, setCatalog] = useState(() => {
    const stored = localStorage.getItem("fixture.catalog");
    return stored ? parseCatalog(JSON.parse(stored)) : createCatalog(snapshot);
  });
  const status = useAccountSync({ catalog, setCatalog, storageEnabled: true });
  const { settings, update, syncState } = useSettings();
  useEffect(() => localStorage.setItem("fixture.catalog", JSON.stringify(catalog)), [catalog]);
  const edit = (title: string) =>
    setCatalog((value) => ({ ...value, trips: value.trips.map((trip) => ({ ...trip, title })) }));
  return (
    <main>
      <p role="status" aria-label="Catalog sync">
        {status}
      </p>
      <p role="status" aria-label="Settings sync">
        {syncState}
      </p>
      <p>Trip: {catalog.trips[0]?.title}</p>
      <p>Theme: {settings.appearance}</p>
      <button onClick={() => edit("First edit")}>First edit</button>
      <button onClick={() => edit("Second edit")}>Second edit</button>
      <button onClick={() => edit("Later real-time edit")}>Later real-time edit</button>
      <button onClick={() => update({ appearance: "dark" })}>Dark</button>
      <button onClick={() => update({ appearance: "light" })}>Light</button>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <SettingsProvider>
    <Workspace />
  </SettingsProvider>,
);
