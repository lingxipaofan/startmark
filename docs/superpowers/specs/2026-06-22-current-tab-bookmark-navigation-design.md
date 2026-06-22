# Current-tab bookmark navigation

## Goal

Opening an individual bookmark from Pinmark should navigate the current manager tab instead of creating a new browser tab.

## Behavior

- Clicking a bookmark card in grid view navigates the current tab to that bookmark URL.
- Clicking the visit button for a bookmark in list view does the same.
- Selection, shift-selection, drag, context-menu, and folder navigation behavior remains unchanged.
- The folder action that opens all bookmarks continues to create multiple tabs.
- Opening Pinmark itself from the extension entry point remains unchanged.

## Implementation

Add a small shared navigation helper that delegates to `window.location.assign`. Both individual-bookmark entry points use that helper, keeping the behavior consistent and independently testable.

## Testing

Add a unit test that verifies the helper assigns the requested URL to the current page. Run the focused test first in the failing state, then run the full test suite, type check, and production build.
