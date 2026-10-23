# Mention menu failure inventory

Written before the code (#630). Each line is a way the @ menu could fail; the browser journey must distinguish them.

- A chip row still renders above the message box at 1440 or 390 width.
- Typing `@` at a word start opens no menu, lists fewer than six assistants, or shows an option without its icon or current name.
- Typing `@` inside a word (`a@b`) opens the menu.
- `@Stay` or `@住` does not filter to the matching assistant, or a custom name does not match.
- The textarea loses focus while the menu is open, or lacks `aria-activedescendant` for the active option.
- Arrow keys do not move the active option, or move the caret in the text instead.
- Tab or Enter does not insert `@name ` with the current (custom or role) name, or Enter sends the message while the menu is open.
- The sent request does not carry the picked specialist id.
- Esc changes the draft, or the menu reopens for the same token before the query changes or the caret moves to another token.
- Backspace right after `@name` deletes a letter instead of selecting exactly the token range.
- The second Backspace does not remove the token, or touches the text before it.
- A key, click or caret move after the first Backspace leaves the next Backspace deleting the whole token.
- Backspace after ordinary text selects something.
- Shift+Tab picks the highlighted option instead of moving focus.
- The menu reopens on a mention that was just picked, before the caret reports its new position.
- A multi-word name (`@Food & d`) closes the menu at its first space, so it cannot be filtered or picked past the first word; or text after a finished name keeps the menu open.
- The first Backspace after a picked mention leaves its trailing space out of the selection, so the second Backspace leaves a stray space.
- During IME composition the menu opens, or Backspace selects a token.
- The page scrolls sideways at phone width, or a page error is logged.
