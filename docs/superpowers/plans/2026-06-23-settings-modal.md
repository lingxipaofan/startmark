# Settings Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline theme, language, and simplified-title controls with one header settings button that opens a centered, immediately applied settings dialog.

**Architecture:** `Header` owns the dialog's open state and keeps the existing application callbacks. A focused `SettingsModal` consumes the i18n context for locale changes and receives theme/title values as props, leaving persistence in the existing owners. React Testing Library exercises the user-visible behavior in jsdom.

**Tech Stack:** React 19, TypeScript, Vitest, React Testing Library, jsdom, lucide-react, CSS

---

### Task 1: Add component test support and define the behavior

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `tests/header-settings.test.tsx`

- [ ] **Step 1: Install test dependencies**

Run:

```powershell
npm install --save-dev @testing-library/react jsdom
```

Expected: dependencies and the lockfile update successfully.

- [ ] **Step 2: Scope jsdom to the component test**

Start `tests/header-settings.test.tsx` with `// @vitest-environment jsdom` so the existing logic tests retain their Node environment.

- [ ] **Step 3: Write the failing settings-dialog tests**

Create `tests/header-settings.test.tsx` with a reusable Header render and assertions that:

```tsx
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Header from "../src/components/Header";
import { I18nProvider } from "../src/lib/i18n";

function renderHeader(overrides = {}) {
  const props = {
    searchQuery: "",
    onSearchChange: vi.fn(),
    bookmarkCount: 12,
    sidebarCollapsed: false,
    onToggleSidebar: vi.fn(),
    viewMode: "grid" as const,
    onViewModeChange: vi.fn(),
    darkMode: false,
    onDarkModeChange: vi.fn(),
    simplifyTitles: false,
    onSimplifyTitlesChange: vi.fn(),
    ...overrides,
  };

  render(<I18nProvider><Header {...props} /></I18nProvider>);
  return props;
}

describe("Header settings", () => {
  beforeEach(() => localStorage.clear());

  it("moves inline controls into a settings dialog and applies changes immediately", () => {
    const props = renderHeader();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dark mode" }));
    expect(props.onDarkModeChange).toHaveBeenCalledWith(true);

    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), {
      target: { value: "ja" },
    });
    expect(localStorage.getItem("pinmark-locale")).toBe("ja");

    fireEvent.click(screen.getByRole("switch", { name: "Simplify titles" }));
    expect(props.onSimplifyTitlesChange).toHaveBeenCalledWith(true);
  });

  it("closes from the close button, backdrop, and Escape", () => {
    renderHeader();
    const open = () => fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    open();
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    open();
    fireEvent.click(screen.getByTestId("settings-backdrop"));
    expect(screen.queryByRole("dialog")).toBeNull();

    open();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
```

- [ ] **Step 4: Run the focused test and verify RED**

Run: `npm test -- tests/header-settings.test.tsx`

Expected: FAIL because Header has no accessible Settings button and still renders the inline language control.

### Task 2: Build and connect the settings modal

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/SettingsModal.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/lib/i18n.tsx`
- Test: `tests/header-settings.test.tsx`

- [ ] **Step 1: Install the icon dependency**

Run: `npm install lucide-react`

Expected: `lucide-react` is recorded as a runtime dependency.

- [ ] **Step 2: Add localized dialog labels**

Add these message keys for `zh`, `en`, and `ja` in `src/lib/i18n.tsx`: `settings`, `close_settings`, `appearance`, `display`, `light_mode`, `dark_mode`, `language`, and the existing simplified-title labels. Reuse existing keys where present; add only missing keys.

- [ ] **Step 3: Create the modal component**

Create `src/components/SettingsModal.tsx` with:

```tsx
import React, { useEffect, useRef } from "react";
import { Check, X } from "lucide-react";
import { useI18n, type Locale } from "../lib/i18n";

interface Props {
  darkMode: boolean;
  onDarkModeChange: (value: boolean) => void;
  simplifyTitles: boolean;
  onSimplifyTitlesChange: (value: boolean) => void;
  onClose: () => void;
}

export default function SettingsModal(props: Props) {
  const { t, locale, setLocale, locales } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [props.onClose]);

  return (
    <div
      className="settings-backdrop"
      data-testid="settings-backdrop"
      onClick={(event) => event.target === event.currentTarget && props.onClose()}
    >
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-modal-header">
          <h2 id="settings-title">{t("settings")}</h2>
          <button ref={closeRef} className="icon-button" onClick={props.onClose} aria-label={t("close_settings")}>
            <X size={18} />
          </button>
        </header>
        <div className="settings-group">
          <h3>{t("appearance")}</h3>
          <div className="settings-segmented" aria-label={t("appearance")}>
            {[false, true].map((isDark) => (
              <button
                key={String(isDark)}
                className={props.darkMode === isDark ? "active" : ""}
                onClick={() => props.onDarkModeChange(isDark)}
                aria-label={t(isDark ? "dark_mode" : "light_mode")}
              >
                {props.darkMode === isDark && <Check size={15} />}
                {t(isDark ? "dark_mode" : "light_mode")}
              </button>
            ))}
          </div>
          <label className="settings-row">
            <span>{t("language")}</span>
            <select aria-label={t("language")} value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              {locales.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
            </select>
          </label>
        </div>
        <div className="settings-group">
          <h3>{t("display")}</h3>
          <label className="settings-row settings-switch-row">
            <span>{t("simplify_titles")}</span>
            <input
              type="checkbox"
              role="switch"
              aria-label={t("simplify_titles")}
              checked={props.simplifyTitles}
              onChange={(e) => props.onSimplifyTitlesChange(e.target.checked)}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Replace Header's inline settings with the modal entry point**

In `src/components/Header.tsx`, remove direct locale handling, add `useState`, import `Settings` from `lucide-react` and `SettingsModal`, render one icon button after the search/view controls, and conditionally render the modal:

```tsx
const [settingsOpen, setSettingsOpen] = React.useState(false);

<button
  type="button"
  className="settings-button"
  onClick={() => setSettingsOpen(true)}
  aria-label={t("settings")}
  title={t("settings")}
>
  <Settings size={18} />
</button>

{settingsOpen && (
  <SettingsModal
    darkMode={darkMode}
    onDarkModeChange={onDarkModeChange}
    simplifyTitles={simplifyTitles}
    onSimplifyTitlesChange={onSimplifyTitlesChange}
    onClose={() => setSettingsOpen(false)}
  />
)}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npm test -- tests/header-settings.test.tsx`

Expected: both tests PASS.

### Task 3: Style the dialog and verify the extension

**Files:**
- Modify: `src/style.css`
- Test: `tests/header-settings.test.tsx`

- [ ] **Step 1: Replace obsolete inline-control styles**

Remove `.title-mode-*`, `.dark-toggle`, and `.lang-select` header rules. Add stable 34px icon-button dimensions, a fixed translucent backdrop, a responsive `min(440px, calc(100vw - 32px))` dialog, compact group spacing, segmented theme buttons, select styling, and a native-looking switch using existing color variables. Keep dialog radius at 8px and ensure dark-mode colors come entirely from existing variables.

- [ ] **Step 2: Run the focused and full tests**

Run:

```powershell
npm test -- tests/header-settings.test.tsx
npm test
```

Expected: focused tests pass; full suite passes with no failures.

- [ ] **Step 3: Run static and production verification**

Run:

```powershell
npm run check
npm run build
```

Expected: TypeScript emits no errors and WXT builds `.output/chrome-mv3` successfully.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only the intended source, dependency, test, and existing user-modified files are listed.
