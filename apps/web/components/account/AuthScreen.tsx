"use client";

import { ClerkFailed, ClerkLoading, SignIn, SignUp } from "@clerk/nextjs";
import { BrandMark } from "../workspace/BrandMark";

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

export function AuthScreen({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-intro" aria-labelledby="auth-title">
          <BrandMark />
          <div className="auth-copy">
            <p className="auth-eyebrow">YOUR TRAVEL WORKSPACE</p>
            <h1 id="auth-title">A good trip starts with a conversation.</h1>
            <p className="auth-description">
              Turn a few ideas into a trip that feels like you. Plan together, see each stop on the
              map, and pick up where you left off.
            </p>
          </div>
          <ol className="auth-benefits">
            <li>
              <span aria-hidden="true">01</span> Tell us what you have in mind
            </li>
            <li>
              <span aria-hidden="true">02</span> Shape your itinerary as you go
            </li>
            <li>
              <span aria-hidden="true">03</span> Keep your trips together, on any device
            </li>
          </ol>
        </section>
        <section
          className="auth-form"
          aria-label={mode === "sign-in" ? "Sign in" : "Create account"}
        >
          <ClerkLoading>
            <p className="auth-status" role="status">
              Loading sign in…
            </p>
          </ClerkLoading>
          <ClerkFailed>
            <div className="auth-status" role="alert">
              <p>We couldn’t load sign in. Check your connection and try again.</p>
              <a href={mode === "sign-in" ? "/sign-in" : "/sign-up"}>Try again</a>
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
        </section>
      </div>
    </main>
  );
}
