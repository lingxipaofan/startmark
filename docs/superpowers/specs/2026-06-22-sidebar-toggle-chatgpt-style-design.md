# Pinmark Sidebar Toggle And ChatGPT Style Design

## Goal

Update Pinmark's manager UI so the folder sidebar can be collapsed and the overall visual style feels closer to the ChatGPT web app: quiet neutral surfaces, compact rounded controls, restrained borders, and a cleaner content canvas.

## Approved Direction

Use visual option A for the overall layout: a full folder sidebar that can collapse completely, giving the bookmark grid or list the full width. Use option B's toggle behavior: the sidebar toggle stays visible in the top header so users can always reopen the sidebar without hunting for an edge handle.

## Behavior

- Add a header toggle button on the left side of the app title.
- The toggle hides or shows the folder sidebar in both grid and list views.
- Persist the collapsed state in `localStorage` so the new tab page remembers the user's preference.
- Keep folder selection, drag/drop, context menus, and new-folder actions unchanged when the sidebar is visible.
- When collapsed, the main content fills the available space and no separate narrow sidebar remains.

## Visual Style

- Shift light mode to a warm-neutral ChatGPT-like palette with `#f7f7f5` page background, white surfaces, soft gray borders, dark neutral text, and a dark active state.
- Shift dark mode to neutral charcoal tones rather than the current blue-purple palette.
- Use compact 8-10px rounded controls, subtle hover states, and lower-contrast card shadows.
- Keep the existing information density and masonry bookmark layout.

## Testing

- Run the existing test suite.
- Build the Chrome extension output.
- Smoke-check the UI in a browser-sized viewport if the local extension/dev page can be served.
