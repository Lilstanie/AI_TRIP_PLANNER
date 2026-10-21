# Workspace control overflow failure inventory

- #477: An unresolved stop name shares a narrow grid row with its status and close control; the name can lose readable word width. Preserve lookup status, close, search and editing.
- #478: A long budget caution must wrap within its own container without horizontal drawer scrolling. Check long English and Chinese labels at narrow drawer widths.
- #479: All trip-fact chips must remain reachable without controls covering one another. Check actual current behavior before changing an already scrolling implementation; retain keyboard, wheel and editor focus.
- #486: A lower chat row menu must remain inside the visible Mine content above the tab bar, with reachable items and Escape focus restoration. Preserve desktop action menus and long stop menus.
- Shared checks: 1440/1024/1001/1000/521/520/390 widths, EN/ZH, viewport resizing, no page errors or horizontal page overflow. Record geometry and screenshots; fixture coverage is not deployment or real-provider proof.
