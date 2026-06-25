import React from "react";
import { useI18n } from "../lib/i18n";
import type { AlphabeticalDirection, SortMode } from "../lib/bookmark-sort";

interface Props {
  x: number;
  y: number;
  kind: "bookmark" | "folder" | "background";
  isRootFolder?: boolean;
  sortMode: SortMode;
  alphabeticalDirection: AlphabeticalDirection;
  isCheckingLinks?: boolean;
  brokenCount?: number;
  onAction: (action: string) => void;
}

export default function ContextMenu({
  x,
  y,
  kind,
  sortMode,
  alphabeticalDirection,
  isCheckingLinks = false,
  brokenCount = 0,
  onAction,
}: Props) {
  const { t } = useI18n();

  const isSortActive = (action: string) =>
    (action === "sort-folder" && sortMode === "folder") ||
    (action === "sort-name-asc" && sortMode === "alphabetical" && alphabeticalDirection === "asc") ||
    (action === "sort-name-desc" && sortMode === "alphabetical" && alphabeticalDirection === "desc") ||
    (action === "sort-time" && sortMode === "time");

  const sortItem = (action: string, label: string) => (
    <div className="context-menu-item" onClick={() => onAction(action)}>
      <span className="context-menu-check">{isSortActive(action) ? "✓" : ""}</span>
      {label}
    </div>
  );

  return (
    <div
      className="context-menu"
      style={{ left: x, top: y, position: "fixed" }}
      onClick={(event) => event.stopPropagation()}
    >
      {kind === "bookmark" && (
        <>
          <div className="context-menu-item" onClick={() => onAction("open-new-tab")}>
            {t("open_new_tab")}
          </div>
          <div className="context-menu-item" onClick={() => onAction("open-new-window")}>
            {t("open_new_window")}
          </div>
          <div className="context-menu-item" onClick={() => onAction("open-incognito-window")}>
            {t("open_incognito_window")}
          </div>
          <div className="context-menu-sep" />
          <div className="context-menu-item" onClick={() => onAction("rename-bookmark")}>
            {t("rename")}
          </div>
          <div className="context-menu-item" onClick={() => onAction("edit-url")}>
            {t("edit_url")}
          </div>
          <div className="context-menu-sep" />
          <div className="context-menu-item" onClick={() => onAction("delete-bookmark")}>
            {t("delete_bookmark")}
          </div>
        </>
      )}

      {kind === "folder" && (
        <>
          <div className="context-menu-item" onClick={() => onAction("open-folder-tab-group")}>
            {t("open_all_in_tab_group")}
          </div>
          <div className="context-menu-item" onClick={() => onAction("new-folder")}>
            {t("new_subfolder")}
          </div>
          <div className="context-menu-sep" />
          <div className="context-menu-item" onClick={() => onAction("rename-folder")}>
            {t("rename")}
          </div>
          <div className="context-menu-item" onClick={() => onAction("delete-folder")}>
            {t("delete_folder")}
          </div>
        </>
      )}

      {kind === "background" && (
        <>
          <div className="context-menu-item" onClick={() => onAction("refresh")}>
            {t("refresh")}
          </div>
          <div className="context-menu-sep" />
          <div className="context-menu-item context-menu-parent">
            <span>{t("sort_options")}</span>
            <span className="context-menu-arrow">›</span>
            <div className="context-submenu">
              {sortItem("sort-folder", t("sort_chrome"))}
              {sortItem("sort-name-asc", t("sort_name_asc"))}
              {sortItem("sort-name-desc", t("sort_name_desc"))}
              {sortItem("sort-time", t("sort_by_time"))}
            </div>
          </div>
          <div className="context-menu-item context-menu-parent">
            <span>{brokenCount ? t("broken_found", { count: brokenCount }) : t("check_links")}</span>
            <span className="context-menu-arrow">›</span>
            <div className="context-submenu">
              <div
                className={`context-menu-item ${isCheckingLinks ? "disabled" : ""}`}
                onClick={() => {
                  if (!isCheckingLinks) onAction("check-links");
                }}
              >
                <span className="context-menu-check" />
                {isCheckingLinks ? t("link_checking") : t("check_links")}
              </div>
              <div className="context-menu-item" onClick={() => onAction("clear-link-marks")}>
                <span className="context-menu-check" />
                {t("clear_link_marks")}
              </div>
            </div>
          </div>
          <div className="context-menu-sep" />
          <div className="context-menu-item" onClick={() => onAction("new-folder")}>
            {t("new_folder")}
          </div>
          <div className="context-menu-sep" />
          <div className="context-menu-item" onClick={() => onAction("settings")}>
            {t("settings")}
          </div>
        </>
      )}
    </div>
  );
}
