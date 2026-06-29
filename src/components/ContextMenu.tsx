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
  hiddenFolderCount?: number;
  showHiddenFolders?: boolean;
  isHiddenFolder?: boolean;
  isFunctionalNode?: boolean;
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
  hiddenFolderCount = 0,
  showHiddenFolders = false,
  isHiddenFolder = false,
  isFunctionalNode = false,
  onAction,
}: Props) {
  const { t } = useI18n();
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ x, y, ready: false, flipSubmenu: false });

  React.useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const margin = 8;
    const nextX = Math.min(Math.max(margin, x), Math.max(margin, window.innerWidth - rect.width - margin));
    const nextY = Math.min(Math.max(margin, y), Math.max(margin, window.innerHeight - rect.height - margin));
    const flipSubmenu = nextX + rect.width + 184 > window.innerWidth - margin;
    setPosition({ x: nextX, y: nextY, ready: true, flipSubmenu });
  }, [x, y, kind, hiddenFolderCount, showHiddenFolders, isCheckingLinks, brokenCount, sortMode, alphabeticalDirection, isFunctionalNode]);

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
      ref={menuRef}
      className={`context-menu ${position.flipSubmenu ? "flip-submenu" : ""}`}
      style={{
        left: position.x,
        top: position.y,
        position: "fixed",
        visibility: position.ready ? "visible" : "hidden",
      }}
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
          {!isFunctionalNode && (
            <>
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
        </>
      )}

      {kind === "folder" && (
        <>
          <div className="context-menu-item" onClick={() => onAction("open-folder-tab-group")}>
            {t("open_all_in_tab_group")}
          </div>
          {!isFunctionalNode && (
            <div className="context-menu-item" onClick={() => onAction("new-folder")}>
              {t("new_subfolder")}
            </div>
          )}
          <div className="context-menu-sep" />
          <div
            className="context-menu-item"
            onClick={() => onAction(isHiddenFolder ? "unhide-folder" : "hide-folder")}
          >
            {isHiddenFolder ? t("show_folder") : t("hide_folder")}
          </div>
          {!isFunctionalNode && (
            <>
              <div className="context-menu-item" onClick={() => onAction("rename-folder")}>
                {t("rename")}
              </div>
              <div className="context-menu-item" onClick={() => onAction("delete-folder")}>
                {t("delete_folder")}
              </div>
            </>
          )}
        </>
      )}

      {kind === "background" && (
        <>
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
          <div
            className="context-menu-item"
            onClick={() => onAction("toggle-hidden-folders")}
          >
            <span className="context-menu-label">
              {showHiddenFolders ? "✓ " : ""}
              {hiddenFolderCount
                ? t("show_hidden_folders_count", { count: hiddenFolderCount })
                : t("show_hidden_folders")}
            </span>
          </div>
          <div className="context-menu-sep" />
          <div className="context-menu-item" onClick={() => onAction("new-folder")}>
            {t("new_folder")}
          </div>
          <div className="context-menu-item" onClick={() => onAction("open-bookmark-manager")}>
            {t("open_bookmark_manager")}
          </div>
        </>
      )}
    </div>
  );
}
