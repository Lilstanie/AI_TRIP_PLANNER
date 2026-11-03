"use client";

import { ClerkFailed, ClerkLoading, SignIn, SignUp } from "@clerk/nextjs";
import { BrandMark } from "../workspace/BrandMark";
import { useAuthPointerFeedback } from "./useAuthPointerFeedback";
import { PasscodeForm } from "./PasscodeForm";
import { useAuthCopy } from "./useAuthCopy";

const appearance = {
  variables: {
    colorPrimary: "var(--accent-fill)",
    colorForeground: "var(--text)",
    colorMutedForeground: "var(--text-dim)",
    colorBackground: "var(--surface)",
    colorInputBackground: "var(--surface-2)",
    colorInputForeground: "var(--text)",
    fontFamily: "var(--font-text)",
    borderRadius: "var(--radius)",
  },
  elements: {
    rootBox: "auth-clerk",
    cardBox: "auth-card-box",
    card: "auth-card",
    footer: "auth-footer",
    socialButtonsBlockButton: "auth-social-button",
    formButtonPrimary: "auth-primary-button",
    formFieldInput: "auth-input",
    footerActionLink: "auth-link",
  },
};

export function AuthScreen({
  mode,
  passcodeError = false,
}: {
  mode: "sign-in" | "sign-up";
  passcodeError?: boolean;
}) {
  const { pageRef, formRef } = useAuthPointerFeedback();
  const copy = useAuthCopy();
  return (
    <main className="auth-page" ref={pageRef}>
      <div className="auth-layout">
        <section className="auth-intro" aria-labelledby="auth-title">
          <BrandMark />
          <div className="auth-copy">
            <p className="auth-eyebrow">{copy.eyebrow}</p>
            <h1 id="auth-title">{copy.title}</h1>
            <p className="auth-description">{copy.description}</p>
          </div>
          <ol className="auth-benefits">
            <li>
              <span aria-hidden="true">01</span> {copy.benefitIdea}
            </li>
            <li>
              <span aria-hidden="true">02</span> {copy.benefitShape}
            </li>
            <li>
              <span aria-hidden="true">03</span> {copy.benefitDevices}
            </li>
          </ol>
        </section>
        <section
          className="auth-form"
          ref={formRef}
          aria-label={mode === "sign-in" ? copy.signIn : copy.createAccount}
        >
          <ClerkLoading>
            <p className="auth-status" role="status">
              {copy.loading}
            </p>
          </ClerkLoading>
          <ClerkFailed>
            <div className="auth-status" role="alert">
              <p>{copy.loadFailed}</p>
              <a href={mode === "sign-in" ? "/sign-in" : "/sign-up"}>{copy.tryAgain}</a>
            </div>
          </ClerkFailed>
          {mode === "sign-in" ? (
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              forceRedirectUrl="/"
              appearance={appearance}
            />
          ) : (
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              forceRedirectUrl="/"
              appearance={appearance}
            />
          )}
          {mode === "sign-in" ? <PasscodeForm error={passcodeError} /> : null}
        </section>
      </div>
    </main>
  );
}
