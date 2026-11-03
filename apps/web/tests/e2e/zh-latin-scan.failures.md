# Chinese interface English scan: failure inventory

Written before the check, from the 2026-11-02 UI loop: about 15 of 64 rounds fixed English left in the
Chinese interface, one place per round (header "New chat", Think constraints, role names, flight and
stay offer cards, revision reasons, "Lisbon之旅"). Each line is a way this check could fail at its job.

- It passes on 5b8a642 (main before #941), so it would not have caught the leaks the loop fixed by eye.
- A place, hotel or carrier name from the trip data (for example "Mock Corner Bistro", "MockAir") is
  reported as a leak.
- Currency codes, the "AI" in the product name, or the Next dev-tools button are reported as leaks.
- The interface is still English (settings ignored or a stale saved language), so the scan reads
  English everywhere or compares the wrong text.
- The mock plan never finishes, so only the empty chat is scanned and every trip screen is skipped.
- A screen does not open and is silently left out instead of failing the run.
- Text inside an open dialog or the expanded Think panel is not read.
- Phone screens (Chat, Map, Trip, Mine) are not covered.
- A leak is reported without the screen and the surrounding text, so nobody can find it.
- The scan never writes a report or screenshots, so a run cannot be compared with a later one.
