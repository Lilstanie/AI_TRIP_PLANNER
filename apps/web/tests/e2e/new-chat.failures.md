# Global New chat: failure inventory

The browser journey uses the public sidebar, composer, Trips page and stored catalog.
Each row must fail if its stated behaviour regresses.

| #   | Situation                                                  | Required behaviour                                                                                                             |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | English and Chinese sidebar, expanded and collapsed        | The first control reads New chat, keeps keyboard order, and Enter opens a chat without the facts form.                         |
| 2   | Collapsed sidebar                                          | The control keeps the New chat tooltip and one icon.                                                                           |
| 3   | Tablet navigation drawer                                   | Its New chat entry opens a plain Chat without the facts form.                                                                  |
| 4   | Phone Mine with no saved data                              | New chat and New trip remain separate collection actions; search, tabs and empty history rows stay hidden.                     |
| 5   | Press New chat twice before sending                        | One untouched plain Chat is reused and no Trip is stored.                                                                      |
| 6   | Send a plain message from that chat                        | One plain Chat is created or reused. No Trip is stored and no trip-facts form opens.                                           |
| 7   | A reply contains a savable Plan                            | Exactly one Trip is linked to that Chat.                                                                                       |
| 8   | Open Your trips                                            | Its own New trip control remains and still opens the facts form.                                                               |
| 9   | Start another Chat while the first Chat's reply is pending | The first request continues, the new Chat has no facts form, and neither Chat shows the other's message.                       |
| 10  | Return to the first Chat while its reply is still pending  | Its message and progress are still visible.                                                                                    |
| 11  | Return after the controlled reply completes                | The complete reply is in the first Chat only.                                                                                  |
| 12  | Complete the journey                                       | No unexpected page errors or external requests occur.                                                                          |
| 13  | Plain chat finishes saving                                 | The saved-local status settles without a repeated save cycle.                                                                  |
| 14  | Phone Mine after sending an ordinary message               | The original Chat remains listed and can be reopened during generation and after completion, even while still titled New chat. |

A full browser reload while a reply is pending is outside this ticket. The controlled stream is not a live provider.
