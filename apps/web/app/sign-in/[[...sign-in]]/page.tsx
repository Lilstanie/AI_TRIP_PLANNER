import { AuthScreen } from "@/components/account/AuthScreen";
import { PasscodeForm } from "@/components/account/PasscodeForm";
import { BrandMark } from "@/components/workspace/BrandMark";
import { authEnabled } from "@/lib/auth/config";

export const metadata = { title: "Sign in · AI Trip Planner" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ passcode?: string }>;
}) {
  const { passcode } = await searchParams;
  const error = passcode === "wrong";
  if (authEnabled) return <AuthScreen mode="sign-in" passcodeError={error} />;
  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-intro">
          <BrandMark />
        </section>
        <section className="auth-form">
          <PasscodeForm error={error} />
        </section>
      </div>
    </main>
  );
}
