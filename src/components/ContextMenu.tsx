import React from "react";
import { useI18n } from "../lib/i18n";

interface Props {
  x: number;
  y: number;
  kind: "bookmark" | "folder" | "background";
  isRootFolder?: boolean;
  onAction: (action: string) => void;
}

export default function ContextMenu({ x, y, kind, isRootFolder = false, onAction }: Props) {
  const { t } = useI18n();

  return (
    <div
      className="context-menu"
      style={{ left: x, top: y, position: "fixed" }}
      onClick={(e) => e.stopPropagation()}
    >
      {kind === "bookmark" && (
        <>
          <div className="context-menu-item" onClick={() => onAction("open-new-tab")}>
            {t("open_new_tab")}
          </div>
          <div className="context-menu-item" onClick={() => onAction("open-new-window")}>
            {t("open_new_window")}
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
      {kind !== "bookmark" && (
        <>
          <div className="context-menu-item" onClick={() => onAction("new-folder")}>
            {t("new_folder")}
          </div>
          {kind === "folder" && !isRootFolder && (
            <>
              <div className="context-menu-sep" />
              <div className="context-menu-item" onClick={() => onAction("rename-folder")}>
                {t("rename")}
              </div>
              <div className="context-menu-item" onClick={() => onAction("delete-folder")}>
                {t("delete_folder")}
              </div>
            </>
          )}
          <div className="context-menu-sep" />
          <div className="context-menu-item" onClick={() => onAction("settings")}>
            {t("settings")}
          </div>
        </>
      )}
    </div>
  );
}
