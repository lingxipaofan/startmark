# Sidebar Toggle ChatGPT Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent folder-sidebar toggle and restyle Pinmark toward a ChatGPT-like neutral interface.

**Architecture:** Keep layout ownership in `entrypoints/manager/App.tsx`, pass the toggle button through `Header`, and isolate localStorage behavior in a small utility so it can be tested without rendering Chrome extension UI. Update `src/style.css` variables and layout classes without changing bookmark data flow.

**Tech Stack:** React 19, TypeScript, WXT, Vitest, CSS custom properties.

---

### Task 1: Sidebar Collapse State Utility

**Files:**
- Create: `src/lib/sidebar-state.ts`
- Create: `tests/sidebar-state.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, test, beforeEach } from "vitest";
import {
  SIDEBAR_COLLAPSED_KEY,
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from "../src/lib/sidebar-state";

describe("sidebar collapsed state", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("defaults to visible when no preference is stored", () => {
    expect(readSidebarCollapsed()).toBe(false);
  });

  test("reads a stored collapsed preference", () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    expect(readSidebarCollapsed()).toBe(true);
  });

  test("persists collapsed preference as a string", () => {
    writeSidebarCollapsed(true);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("true");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test tests/sidebar-state.test.ts`
Expected: FAIL because `src/lib/sidebar-state.ts` does not exist.

- [ ] **Step 3: Implement the utility**

```typescript
export const SIDEBAR_COLLAPSED_KEY = "pinmark-sidebar-collapsed";

export function readSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

export function writeSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test tests/sidebar-state.test.ts`
Expected: PASS.

### Task 2: Header Toggle And Shared Layout State

**Files:**
- Modify: `entrypoints/manager/App.tsx`
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Wire sidebar state into App**

Import `readSidebarCollapsed` and `writeSidebarCollapsed`. Add `const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);`, persist it in an effect, add `sidebar-collapsed` to the app class, and pass `sidebarCollapsed` plus `onToggleSidebar` to `Header`.

- [ ] **Step 2: Hide folder panels conditionally**

Wrap both grid and list `<aside className="folder-panel">...</aside>` blocks in `!sidebarCollapsed && (...)` so collapsed mode gives the main panel the full width.

- [ ] **Step 3: Add Header props and button**

Add `sidebarCollapsed: boolean` and `onToggleSidebar: () => void` props. Render a button before the title with class `sidebar-toggle-btn`, aria-label/title based on collapsed state, and a `☰` icon.

### Task 3: ChatGPT-Like Styling

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Update color variables**

Use warm-neutral light variables and charcoal dark variables. Keep existing semantic variable names so components do not need structural changes.

- [ ] **Step 2: Style the header toggle and collapsed layout**

Add `.sidebar-toggle-btn`, `.app.sidebar-collapsed .main-layout`, and tightened header/search/control styles. The toggle stays in the header in both expanded and collapsed states.

- [ ] **Step 3: Tune panels, cards, buttons, and selected states**

Reduce heavy blue usage, use neutral active states, soften shadows, keep 8-10px radii, and preserve the current dense bookmark layout.

### Task 4: Verification

**Files:**
- Existing test/build outputs only.

- [ ] **Step 1: Run focused test**

Run: `npm test tests/sidebar-state.test.ts`
Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Build extension**

Run with Node 22 in this workspace: `npm run build`
Expected: WXT builds `.output/chrome-mv3/manifest.json`.
