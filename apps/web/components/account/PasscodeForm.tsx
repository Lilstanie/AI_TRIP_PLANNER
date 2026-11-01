import { signInWithPasscode } from "@/app/sign-in/actions";

export function PasscodeForm({ error }: { error: boolean }) {
  return (
    <form action={signInWithPasscode} className="admin-fields">
      <label htmlFor="admin-passcode">Admin passcode</label>
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
          That passcode is not right.
        </p>
      ) : null}
      <button className="admin-button" type="submit">
        Enter with passcode
      </button>
    </form>
  );
}
