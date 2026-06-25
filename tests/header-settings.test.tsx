// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Header from "../src/components/Header";
import { I18nProvider } from "../src/lib/i18n";

function renderHeader(overrides = {}) {
  const props = {
    searchQuery: "",
    onSearchChange: vi.fn(),
    darkMode: false,
    onDarkModeChange: vi.fn(),
    simplifyTitles: false,
    onSimplifyTitlesChange: vi.fn(),
    showRootFolders: true,
    onShowRootFoldersChange: vi.fn(),
    ...overrides,
  };

  render(
    <I18nProvider>
      <Header {...props} />
    </I18nProvider>,
  );
  return props;
}

describe("Header settings", () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("startmark-locale", "en");
  });

  it("renders navigation-only controls", () => {
    renderHeader();
    expect(screen.queryByText("List")).toBeNull();
    expect(screen.queryByText("Grid")).toBeNull();
    expect(screen.queryByTitle("Show folders")).toBeNull();
    expect(screen.queryByTitle("Hide folders")).toBeNull();
  });

  it("moves inline controls into a settings dialog and applies changes immediately", () => {
    const props = renderHeader();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Dark mode" }));
    expect(props.onDarkModeChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("switch", { name: "Short titles" }));
    expect(props.onSimplifyTitlesChange).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("switch", { name: "Show root folders" }));
    expect(props.onShowRootFoldersChange).toHaveBeenCalledWith(false);

    const zoomChange = vi.fn();
    cleanup();
    renderHeader({ zoom: 1, onZoomChange: zoomChange });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    const zoomSlider = screen.getByRole("slider", { name: "Interface scale" });
    expect(zoomSlider.getAttribute("step")).toBe("any");
    fireEvent.change(zoomSlider, {
      target: { value: "1.15" },
    });
    expect(zoomChange).toHaveBeenCalledWith(1.15);

    const languageSelect = screen.getByRole("combobox", { name: "Language" });
    languageSelect.focus();
    fireEvent.change(languageSelect, {
      target: { value: "ja" },
    });
    expect(localStorage.getItem("startmark-locale")).toBe("ja");
    expect(document.activeElement).toBe(languageSelect);
  });

  it("closes from the close button, backdrop, and Escape", () => {
    renderHeader();
    const open = () => {
      fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    };

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
