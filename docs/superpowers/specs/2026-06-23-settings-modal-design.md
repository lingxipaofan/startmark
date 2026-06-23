# Settings modal

## Goal

Reduce header clutter by moving theme, language, and simplified-title controls into one extensible settings interface.

## Entry point

The header replaces the three existing controls with one icon-only settings button using a familiar gear icon. The button has a localized accessible label and tooltip. Activating it opens a centered modal.

## Modal behavior

- The modal has a title, a top-right close button, and grouped settings.
- Clicking the backdrop, activating the close button, or pressing `Escape` closes it.
- The dialog is identified with `role="dialog"`, an accessible name, and modal semantics.
- Settings apply immediately. There are no Save or Cancel buttons.
- Closing and reopening the modal shows the current values.

## Settings

### Appearance

Theme is presented as a two-option segmented control for light and dark mode.

### Language

Language remains a select control populated from the existing locale list.

### Display

Simplified bookmark titles remain a binary switch with the existing explanatory text.

## State and persistence

`App` continues to own theme and simplified-title state. The i18n provider continues to own locale state. Existing local-storage keys and effects remain unchanged, so every change is applied and persisted immediately.

The new `SettingsModal` receives current values and change callbacks as props. `Header` owns only whether the modal is open. This keeps the settings surface easy to extend without moving application state into presentation code.

## Visual treatment

The dialog follows the existing neutral ChatGPT-inspired styling: restrained border and shadow, compact rows, clear group labels, and no nested cards. The backdrop lightly separates the dialog from the bookmark manager while preserving context.

## Testing

- Verify the header exposes one settings button instead of the three inline controls.
- Verify the modal opens and closes through the button, close control, backdrop, and `Escape`.
- Verify theme, language, and simplified-title changes call their existing handlers immediately.
- Run the full unit suite, TypeScript check, and production build.
