import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useI18n } from "../lib/i18n";

interface Props {
  title: string;
  initialValue: string;
  label: string;
  inputType?: "text" | "url";
  onCancel: () => void;
  onSave: (value: string) => void | Promise<void>;
}

export default function EditDialog({
  title,
  initialValue,
  label,
  inputType = "text",
  onCancel,
  onSave,
}: Props) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextValue = value.trim();
    if (!nextValue || saving) return;
    setSaving(true);
    try {
      await onSave(nextValue);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="edit-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <form className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-dialog-title" onSubmit={submit}>
        <header className="edit-dialog-header">
          <h2 id="edit-dialog-title">{title}</h2>
          <button type="button" className="edit-dialog-close" onClick={onCancel} aria-label={t("cancel")}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <label className="edit-dialog-field">
          <span>{label}</span>
          <input
            ref={inputRef}
            type={inputType}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <footer className="edit-dialog-actions">
          <button type="button" className="edit-dialog-button" onClick={onCancel}>{t("cancel")}</button>
          <button type="submit" className="edit-dialog-button primary" disabled={!value.trim() || saving}>
            {t("save")}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
