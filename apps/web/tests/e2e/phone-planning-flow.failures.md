# Phone planning flow failure inventory

Scope: fixture-backed phone Chat from an empty workspace through planning feedback, failure,
revision failure and an explicit move to Trip. A passing browser run does not prove live-provider
latency, a physical keyboard or device safe-area behaviour.

| Failure                                              | Observable requirement                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| A blank phone chat shows every prompt                | Show at most two example prompts.                                         |
| Prompts remain after the first message               | Remove the prompt group once messages exist.                              |
| A keyboard contracts the viewport                    | Keep the focused composer and Send reachable without horizontal overflow. |
| Progress is absent while planning                    | Keep the current stage visible in Chat while the request is busy.         |
| Completion silently changes tabs                     | Keep Chat active and expose an accessible Open trip action.               |
| Completion has no route to the Plan                  | Open trip only after an explicit action.                                  |
| Initial failure loses the traveller's text           | Restore the submitted text when the turn fails.                           |
| Initial failure retries automatically                | Leave the request stopped until Retry update is chosen.                   |
| Revision failure replaces the Plan                   | Keep the readable Plan and present the error with explicit retry.         |
| The compact summary does not expose Brief details    | Opening the title presents the Brief facts sheet.                         |
| A locale, narrow phone or breakpoint loses a control | Cover EN/ZH at 360, 375 and 390 px, 520/521 and desktop.                  |
