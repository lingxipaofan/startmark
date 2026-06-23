import React from "react";
import { useI18n } from "../lib/i18n";

interface Props {
  x: number;
  y: number;
  onAction: (action: string) => void;
}

export default function ContextMenu({ x, y, onAction }: Props) {
  const { t } = useI18n();

  return (
    <div
      className="context-menu"
      style={{ left: x, top: y, position: "fixed" }}
      onClick={(e) => e.stopPropagation()}
    >
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
    </div>
  );
}
