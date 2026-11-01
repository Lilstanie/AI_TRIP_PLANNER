import { Workspace } from "@/components/workspace/Workspace";
import { IntroGate } from "@/components/intro/IntroGate";

export default function Page() {
  return (
    <IntroGate>
      <Workspace />
    </IntroGate>
  );
}
