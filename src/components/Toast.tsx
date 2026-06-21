import React from "react";
import { useI18n } from "../lib/i18n";

interface Props {
  message: string;
  onUndo?: () => void | Promise<void>;
  onClose: () => void;
}

export default function Toast({ message, onUndo, onClose }: Props) {
  const { t } = useI18n();
  const [isUndoing, setIsUndoing] = React.useState(false);

  const handleUndo = async () => {
    if (!onUndo || isUndoing) return;
    setIsUndoing(true);
    try {
      await onUndo();
      onClose();
    } catch {
      // The undo callback reports a localized error to the user.
    } finally {
      setIsUndoing(false);
    }
  };

  return (
    <div className="toast" onClick={(e) => e.stopPropagation()}>
      <span className="toast-message">{message}</span>
      {onUndo && (
        <button className="toast-undo" onClick={handleUndo} disabled={isUndoing}>
          {t("undo")}
        </button>
      )}
      <button className="toast-close" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}
