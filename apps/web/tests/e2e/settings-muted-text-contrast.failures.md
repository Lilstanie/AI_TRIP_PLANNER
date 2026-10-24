# Settings muted text contrast: failure inventory

Written before the fix (#642). Settings supporting text used the text colour at 50% alpha, about
3.2:1 on the dialog glass. Each line is a way the fix could fail.

- An intro line, hint, sync note or footnote in any Settings section stays below 4.5:1 against the
  dialog fill over a white or light-grey backdrop (light theme).
- The same text falls below 4.5:1 in the dark theme against a black or dark-grey backdrop.
- A Settings section is skipped, so its text is never measured.
- The text loses its muted look, reaching the full body text colour.
