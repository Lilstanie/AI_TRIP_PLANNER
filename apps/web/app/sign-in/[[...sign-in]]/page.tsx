import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/account/AuthScreen";
import { authEnabled } from "@/lib/auth/config";

export const metadata = { title: "Sign in · AI Trip Planner" };

export default function SignInPage() {
  if (!authEnabled) redirect("/");
  return <AuthScreen mode="sign-in" />;
}
