# Top bar fit failure inventory

Written before the desktop top bar was fixed for mid-size windows.

- With the Trip open on a 1440 px window, the trip fact chips slide under Agent Team and Mock data,
  so those buttons cannot be read or clicked.
- At about 1280 px the chips take an implicit grid column beside the title, and the chat title
  shrinks to a single letter.
- The fix makes the chips vanish or scroll out of sight at some width.
- The Agent Team label wraps onto two lines.
- The title stops truncating with an ellipsis and pushes the actions off screen.
- The phone top bar changes.

Evidence: `topbar-fit.e2e.mjs` records each control's box at every width and screenshots the bar.
