import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { useI18n, type Locale } from "../lib/i18n";

interface Props {
  darkMode: boolean;
  onDarkModeChange: (value: boolean) => void;
  simplifyTitles: boolean;
  onSimplifyTitlesChange: (value: boolean) => void;
  onClose: () => void;
}

export default function SettingsModal({
  darkMode,
  onDarkModeChange,
  simplifyTitles,
  onSimplifyTitlesChange,
  onClose,
}: Props) {
  const { t, locale, setLocale, locales } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="settings-backdrop"
      data-testid="settings-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header className="settings-modal-header">
          <h2 id="settings-title">{t("settings")}</h2>
          <button
            ref={closeRef}
            type="button"
            className="settings-close-button"
            onClick={onClose}
            aria-label={t("close_settings")}
            title={t("close_settings")}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="settings-content">
          <section className="settings-group" aria-labelledby="appearance-heading">
            <h3 id="appearance-heading">{t("appearance")}</h3>
            <div className="settings-segmented" aria-label={t("appearance")}>
              {[false, true].map((isDark) => (
                <button
                  key={String(isDark)}
                  type="button"
                  className={darkMode === isDark ? "active" : ""}
                  onClick={() => onDarkModeChange(isDark)}
                  aria-label={t(isDark ? "dark_mode" : "light_mode")}
                  aria-pressed={darkMode === isDark}
                >
                  <span className="settings-check-slot" aria-hidden="true">
                    {darkMode === isDark && <Check size={15} />}
                  </span>
                  {t(isDark ? "dark_mode" : "light_mode")}
                </button>
              ))}
            </div>

            <label className="settings-row">
              <span>{t("language")}</span>
              <select
                aria-label={t("language")}
                value={locale}
                onChange={(event) => setLocale(event.target.value as Locale)}
              >
                {locales.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="settings-group" aria-labelledby="display-heading">
            <h3 id="display-heading">{t("display")}</h3>
            <label className="settings-row settings-switch-row" title={t("simplify_titles_hint")}>
              <span className="settings-label-copy">
                <strong>{t("simplify_titles")}</strong>
                <small>{t("simplify_titles_hint")}</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-label={t("simplify_titles")}
                checked={simplifyTitles}
                onChange={(event) => onSimplifyTitlesChange(event.target.checked)}
              />
              <span className="settings-switch-track" aria-hidden="true">
                <span className="settings-switch-thumb" />
              </span>
            </label>
          </section>
        </div>
      </section>
    </div>,
    document.body,
  );
}
