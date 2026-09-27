import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/account/AuthScreen";
import { authEnabled } from "@/lib/auth/config";

export const metadata = { title: "Create account · AI Trip Planner" };

export default function SignUpPage() {
  if (!authEnabled) redirect("/");
  return <AuthScreen mode="sign-up" />;
}
