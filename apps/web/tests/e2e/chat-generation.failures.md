# Chat-owned generation: failure inventory

The browser journey exercises the public chat and navigation controls with a controlled
`/api/chat` stream. Each row must fail if its stated behaviour regresses.

| #   | Situation                                                                             | Required behaviour                                                                                                      |
| --- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Open another Chat, another Trip, Trips, Calendar or Settings while a reply is pending | The request continues; navigation neither aborts nor repeats it.                                                        |
| 2   | Return to the initiating Chat while its reply is pending                              | Its user message, live progress and received partial content are restored.                                              |
| 3   | Return after the reply completed in the background                                    | The complete reply is visible in the initiating Chat only.                                                              |
| 4   | Complete a reply while another Chat is open                                           | The other Chat's messages and activity are unchanged.                                                                   |
| 5   | Send, navigate, complete and recover one turn                                         | Exactly one request and one user message exist; recovery starts no request.                                             |
| 6   | Stop the initiating Chat's pending turn                                               | That request aborts and the Chat shows a stopped state with no retry offered as a completed result.                     |
| 7   | Send again after Stop                                                                 | One new request starts in the same Chat, both user messages are retained, and the stopped turn does not block the send. |
| 8   | The controlled stream fails                                                           | The initiating Chat shows failure and Retry; no reply is fabricated.                                                    |
| 9   | Retry after failure                                                                   | One new request starts in the same Chat and its existing user message is not duplicated.                                |
| 10  | Edit the current Trip Plan directly while a reply is pending                          | The manual edit remains visible and enabled.                                                                            |
| 11  | A late completed Plan returns after a manual edit                                     | The manual Plan is retained; the model reply is stored in the initiating Chat with a localized conflict notice.         |
| 12  | Open an older Chat after a newer Trip Plan exists                                     | The Trip Plan is not downgraded by the older Chat snapshot.                                                             |
| 13  | Delete the Chat or Trip owning a pending turn                                         | Its request is cancelled and cannot write into deleted history.                                                         |
| 14  | Leave the Workspace while a reply is pending                                          | Every owned pending request is cancelled and cannot write after teardown.                                               |
| 15  | Concurrent turns target the same Trip from two Chats                                  | At most one Chat writer owns that Trip; the refused Chat adds no request or user message.                               |
| 16  | Concurrent turns target different Trips                                               | Both requests run independently and each reply and Plan is stored only under its originating Chat and Trip.             |
| 17  | Reload or close the browser while a reply is pending                                  | Durable execution is explicitly outside this ticket's contract.                                                         |
| 18  | Complete all controlled journeys                                                      | No unexpected browser page errors or external network requests occur.                                                   |

Evidence uses real Chromium and streamed `Response` objects whose progress and completion frames are
released by the test, so the assertions observe incremental browser behaviour. A controlled map path
may prove that navigation continues generation; Ticket 1 owns map failure recovery.
