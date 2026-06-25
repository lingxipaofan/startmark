// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContextMenu from "../src/components/ContextMenu";
import { I18nProvider } from "../src/lib/i18n";

function renderMenu(kind: "bookmark" | "folder" | "background", onAction = vi.fn()) {
  render(
    <I18nProvider>
      <ContextMenu
        x={10}
        y={20}
        kind={kind}
        sortMode="folder"
        alphabeticalDirection="asc"
        onAction={onAction}
      />
    </I18nProvider>,
  );
  return onAction;
}

describe("ContextMenu", () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("startmark-locale", "en");
  });

  it("shows refresh in the background menu", () => {
    const onAction = renderMenu("background");

    fireEvent.click(screen.getByText("Refresh"));

    expect(onAction).toHaveBeenCalledWith("refresh");
  });

  it("moves sort and link checking actions into submenus", () => {
    const onAction = renderMenu("background");

    fireEvent.click(screen.getByText("Name A-Z"));
    fireEvent.click(screen.getAllByText("Check Links")[1]);
    fireEvent.click(screen.getByText("Clear marks"));

    expect(onAction).toHaveBeenCalledWith("sort-name-asc");
    expect(onAction).toHaveBeenCalledWith("check-links");
    expect(onAction).toHaveBeenCalledWith("clear-link-marks");
  });

  it("keeps refresh out of bookmark item menus", () => {
    renderMenu("bookmark");

    expect(screen.queryByText("Refresh")).toBeNull();
    expect(screen.getByText("Open in new tab")).toBeTruthy();
  });

  it("shows only folder-specific actions for folder menus", () => {
    const onAction = renderMenu("folder");

    expect(screen.getByText("Open all in new tab group")).toBeTruthy();
    expect(screen.getByText("+ New Subfolder")).toBeTruthy();
    expect(screen.getByText("Rename")).toBeTruthy();
    expect(screen.getByText("Delete Folder")).toBeTruthy();
    expect(screen.queryByText("Refresh")).toBeNull();
    expect(screen.queryByText("Sort options")).toBeNull();
    expect(screen.queryByText("Check Links")).toBeNull();
    expect(screen.queryByText("Settings")).toBeNull();

    fireEvent.click(screen.getByText("Open all in new tab group"));
    expect(onAction).toHaveBeenCalledWith("open-folder-tab-group");
  });

  it("can open bookmark items in a new incognito window", () => {
    const onAction = renderMenu("bookmark");

    fireEvent.click(screen.getByText("Open in new incognito window"));

    expect(onAction).toHaveBeenCalledWith("open-incognito-window");
  });
});
