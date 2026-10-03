# Agent Note: Structured addresses with explicit location lookup

Status: implemented
Owner: E (@WhW0591)

## Problem

Free-text addresses are ambiguous. The user requests structured entry without paid autocomplete
or a local address database, requires a departure address, and explicitly approves free OSM
reverse geocoding only after clicking the location button.

## Decision

Where uses City and Country as required fields for both ends; Suburb and State are optional.
TripAddress and TripLocations preserve these fields alongside legacy agent-facing text. The web
client requires structured locations before planning; older API clients remain compatible.
Unknown countries are not inferred from legacy text. Changing a legacy location through chat
clears stale metadata and asks the traveller to confirm the address.

The location button obtains browser coordinates only on click and sends them rounded to three
decimal places to the server's Nominatim reverse adapter. Its process-wide gate is shared with
existing Nominatim map queries, caches up to 100 responses for 24 hours, and spaces new requests
by at least 1.1 seconds. The UI credits OSM and protects manual edits from late responses.
This supplements the [fact-chip interaction](2026-09-24-preference-chips.md), not the map display.

The tools package exposes this explicit user utility through its separate location subpath;
the main entry point keeps the team's ToolGateway-only agent-provider boundary. Map lookups
use the shared limiter in maps-port, preserving captured configuration and injected fetch.

## Alternatives considered

- Paid address autocomplete: rejected by the user because of cost.
- Local address database: rejected by the user because of storage requirements.
- Automatic position queries: rejected; the user authorizes lookup only on explicit clicks.

## Consequences

Manual entry works without network lookups. City and country names are not verified against a
database; travellers must review them. Public Nominatim is best-effort and rejects excess clicks;
failure leaves manual entry available. Multiple application instances require deployment-wide
rate limiting or a different configured service. No Google map or route capability is removed.

## Sources

- [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)
- [Reverse API](https://nominatim.org/release-docs/latest/api/Reverse/)
