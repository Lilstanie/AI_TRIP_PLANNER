import { Workspace } from "@/components/workspace/Workspace";
import { IntroGate } from "@/components/intro/IntroGate";
import { isAdminRequest } from "@/lib/auth/admin";

export default async function Page() {
  const admin = await isAdminRequest();
  return (
    <IntroGate>
      <Workspace admin={admin} />
    </IntroGate>
  );
}
