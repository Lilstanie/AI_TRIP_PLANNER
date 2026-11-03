"use client";

import { signInWithPasscode } from "@/app/sign-in/actions";
import { useAuthCopy } from "./useAuthCopy";

export function PasscodeForm({ error }: { error: boolean }) {
  const copy = useAuthCopy();
  return (
    <form action={signInWithPasscode} className="admin-fields">
      <label htmlFor="admin-passcode">{copy.passcode}</label>
      <input
        id="admin-passcode"
        name="passcode"
        type="password"
        autoComplete="off"
        required
        aria-invalid={error}
        aria-describedby={error ? "admin-error" : undefined}
      />
      {error ? (
        <p id="admin-error" className="admin-error" role="alert">
          {copy.passcodeWrong}
        </p>
      ) : null}
      <button className="admin-button" type="submit">
        {copy.passcodeSubmit}
      </button>
    </form>
  );
}
