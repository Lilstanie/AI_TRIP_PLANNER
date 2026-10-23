# Phone personalization target failure inventory

Baseline: `origin/main` at `c81bca2dad8851bc5b6ca1782da83b2788533132`; reproduce through the phone Mine tab and Settings > Personalization at 390 × 844 in English and Chinese.

- Travellers, Pace, and Interests `.memory-row__main` Edit buttons render at 34 px when their text stays on one line, while wrapped rows are taller; measure the actual main buttons, not their separate Answer buttons.
- The fix can satisfy a computed minimum while leaving the real hit target short because a more specific/important style overrides it; assert rendered bounds and inspect computed CSS.
- Expanding controls can overlap the following row or cause horizontal overflow; verify adjacent rows remain independently clickable and document width stays 390 px.
- Changing the target can disturb desktop sizing or dialog layout; compare the same controls at 1440 × 1000.
- Translated labels can wrap differently and reintroduce a short target; repeat the measurements after switching to 简体中文.
- A target can be large but unusable if its lower edge is obscured or the wrong editor opens; exercise the control and verify its accessible editor in both locales.
- Browser errors or a failed workspace journey can make dimensions meaningless; retain page-error checks and a repeatable report with screenshots.
