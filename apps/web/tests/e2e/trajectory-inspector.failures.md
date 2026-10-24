# Trajectory record inspector failure inventory

Written before the code (TP-74, #670). Each line is a way the inspector could fail; the browser journey must distinguish them.

- Opening an assignment shows no objective, or the objective of another assignment.
- An assignment's inspector omits the specialist's output, or shows the output of another specialist.
- A tool call's inspector omits its arguments or its result.
- A failed tool call or failed assignment shows no failure text in the inspector, or shows a success summary.
- The conflict check's inspector shows only raw JSON: it does not state the conflict reason or name the specialist the check sends back.
- The conflict check names the specialist by its id instead of the interface-language or renamed name.
- A token count, a duration, a clock time or an elapsed value appears anywhere in the inspector, including its tabs.
- Esc does not close the inspector, closes it only when focus is inside it, or leaves the record selected.
- The close control closes the inspector but focus falls to the page body instead of the record's row.
- After Esc, focus returns to a different record than the one that was open.
- Esc with no inspector open changes the selection or steals focus.
- English labels appear in the inspector under the Chinese interface, or Chinese under English.
- The page overflows horizontally or logs a page error at 1440 px.

The E2E runs in mock data mode with no keys and saves screenshots of an assignment, a tool call and the conflict check, plus result.json. The first run is expected to fail before implementation.
