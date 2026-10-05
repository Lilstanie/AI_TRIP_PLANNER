"use client";

/**
 * Whether the on-screen keyboard is open in the phone shell. Filled in by #180; until then the
 * tab bar never hides.
 */
export function usePhoneKeyboard(_enabled: boolean) {
  return { keyboardOpen: false };
}
