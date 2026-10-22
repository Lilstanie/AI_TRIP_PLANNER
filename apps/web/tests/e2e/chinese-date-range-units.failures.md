# Chinese date range failures

- `Intl.DateTimeFormat.formatRange` can return slash-only Chinese ranges even when `format` names the month. Assert literal visible Chinese dates, not another call to the formatter under test.
- The dates chip, browser title and saved chat row must share the same unambiguous range; verify each public surface.
- Same-month, different-month and cross-year ranges must retain both endpoints. Include years outside the controlled current year and across a year boundary.
- Preserve English ranges and full accessible calendar dates, timezone independence, keyboard activation and language changes.
- Check desktop and phone layout and runtime errors. Saved catalog fixtures are not evidence of live model extraction or providers.
