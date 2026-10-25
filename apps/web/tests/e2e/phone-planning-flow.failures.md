# Phone planning flow failure inventory

Public seam: the real workspace UI with external chat responses supplied by local browser fixtures.
The traveller approved this seam in spec #715 and ticket #718.

- Blank phone chat shows more than two examples, pushing Send outside the short viewport.
- Examples remain after the first message and compete with conversation content.
- Brief summary cannot reopen destination, dates, party, budget and preferences.
- Planning progress is available only through another view, or completion forces a tab switch.
- Completion offers no direct way to read the new Plan.
- Initial failure erases the submitted input or requires an automatic retry.
- Revision failure replaces the previous Plan or loses the editable revision request.
- Keyboard-contracted phone viewport hides the focused field or Send.
- Chinese labels, reduced motion, narrow widths or desktop layout regress.

Artifacts must record assertions, configuration, page errors and screenshots. Browser viewport
simulation does not establish physical-device keyboard, safe-area or live-provider behaviour.
