import { createRoot } from "react-dom/client";
import { SettingsDialog } from "@/components/account/SettingsDialog";
import { LocaleProvider } from "@/components/account/LocaleProvider";
import { SettingsProvider } from "@/components/account/SettingsProvider";
import { setFixtureAccount } from "./account";
import "@/app/styles/tokens.css";
import "@/app/styles/base.css";
import "@/app/styles/settings.css";
import "@/app/styles/phone.css";

function Fixture() {
  return (
    <SettingsProvider>
      <LocaleProvider>
        <main className="memory-settings-fixture">
          <button type="button" onClick={() => setFixtureAccount("local")}>
            Sign out fixture account
          </button>
          <section className="dialog" role="dialog" aria-label="Settings">
            <SettingsDialog onDataMode={() => {}} onAccountModal={() => {}} />
          </section>
        </main>
      </LocaleProvider>
    </SettingsProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
