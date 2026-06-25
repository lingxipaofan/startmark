// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConfirmDialog from "../src/components/ConfirmDialog";
import { I18nProvider } from "../src/lib/i18n";

function renderDialog() {
  const props = { onConfirm: vi.fn(), onCancel: vi.fn() };
  render(
    <I18nProvider>
      <ConfirmDialog
        message="Delete 1 item?"
        onConfirm={props.onConfirm}
        onCancel={props.onCancel}
      />
    </I18nProvider>,
  );
  return props;
}

describe("ConfirmDialog", () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("startmark-locale", "en");
  });

  it("uses an app dialog and focuses the safe action", () => {
    renderDialog();
    expect(screen.getByRole("alertdialog", { name: "Confirm deletion" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });

  it("confirms deletion", () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it("supports cancel and Escape", () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(props.onCancel).toHaveBeenCalledTimes(2);
  });
});
