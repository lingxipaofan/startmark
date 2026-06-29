import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { useI18n, type Locale } from "../lib/i18n";
import {
  BUILT_IN_SEARCH_ENGINES,
  createCustomSearchEngine,
  type CustomSearchEngine,
  type SearchEngineId,
} from "../lib/search-engine";

interface Props {
  darkMode: boolean;
  onDarkModeChange: (value: boolean) => void;
  simplifyTitles: boolean;
  onSimplifyTitlesChange: (value: boolean) => void;
  searchEngine: SearchEngineId;
  onSearchEngineChange: (value: SearchEngineId) => void;
  customSearchEngines: CustomSearchEngine[];
  onCustomSearchEnginesChange: (value: CustomSearchEngine[]) => void;
  showRootFolders: boolean;
  onShowRootFoldersChange: (value: boolean) => void;
  zoom: number;
  onZoomChange: (value: number) => void;
  onClose: () => void;
}

export default function SettingsModal({
  darkMode,
  onDarkModeChange,
  simplifyTitles,
  onSimplifyTitlesChange,
  searchEngine,
  onSearchEngineChange,
  customSearchEngines,
  onCustomSearchEnginesChange,
  showRootFolders,
  onShowRootFoldersChange,
  zoom,
  onZoomChange,
  onClose,
}: Props) {
  const { t, locale, setLocale, locales } = useI18n();
  const closeRef = useRef<HTMLButtonElement>(null);

  const updateCustomEngine = (id: string, patch: Partial<CustomSearchEngine>) => {
    onCustomSearchEnginesChange(
      customSearchEngines.map((engine) =>
        engine.id === id ? { ...engine, ...patch } : engine
      )
    );
  };

  const addCustomEngine = () => {
    const engine = createCustomSearchEngine();
    const next = [
      ...customSearchEngines,
      {
        ...engine,
        title: t("custom_search_engine"),
      },
    ];
    onCustomSearchEnginesChange(next);
    onSearchEngineChange(engine.id);
  };

  const deleteCustomEngine = (id: SearchEngineId) => {
    onCustomSearchEnginesChange(customSearchEngines.filter((engine) => engine.id !== id));
    if (searchEngine === id) onSearchEngineChange("browser");
  };

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

          <section className="settings-group" aria-labelledby="search-heading">
            <h3 id="search-heading">{t("search_settings")}</h3>
            <label className="settings-row">
              <span>{t("search_engine")}</span>
              <select
                aria-label={t("search_engine")}
                value={searchEngine}
                onChange={(event) => onSearchEngineChange(event.target.value as SearchEngineId)}
              >
                {BUILT_IN_SEARCH_ENGINES.map((engine) => (
                  <option key={engine.id} value={engine.id}>
                    {engine.label.includes("_") ? t(engine.label) : engine.label}
                  </option>
                ))}
                {customSearchEngines.length > 0 && (
                  <optgroup label={t("custom_search_engines")}>
                    {customSearchEngines.map((engine) => (
                      <option key={engine.id} value={engine.id}>
                        {engine.title.trim() || t("custom_search_engine")}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
            <div className="settings-custom-engines">
              <div className="settings-custom-engines-header">
                <span className="settings-label-copy">
                  <strong>{t("custom_search_engines")}</strong>
                  <small>{t("custom_search_template_hint")}</small>
                </span>
                <button type="button" className="settings-inline-button" onClick={addCustomEngine}>
                  {t("add_search_engine")}
                </button>
              </div>
              {customSearchEngines.map((engine) => (
                <div className="settings-custom-engine-card" key={engine.id}>
                  <input
                    type="text"
                    value={engine.title}
                    placeholder={t("custom_search_title")}
                    aria-label={t("custom_search_title")}
                    onChange={(event) => updateCustomEngine(engine.id, { title: event.target.value })}
                  />
                  <input
                    type="url"
                    value={engine.template}
                    placeholder="https://example.com/search?q=%s"
                    aria-label={t("custom_search_template")}
                    onChange={(event) => updateCustomEngine(engine.id, { template: event.target.value })}
                  />
                  <button
                    type="button"
                    className="settings-inline-button danger"
                    onClick={() => deleteCustomEngine(engine.id)}
                  >
                    {t("delete_search_engine")}
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="settings-group" aria-labelledby="display-heading">
            <h3 id="display-heading">{t("display")}</h3>
            <label className="settings-zoom-row">
              <span className="settings-zoom-copy">
                <strong>{t("zoom")}</strong>
                <output>{Math.round(zoom * 100)}%</output>
              </span>
              <input
                type="range"
                min="0.75"
                max="1.25"
                step="any"
                value={zoom}
                aria-label={t("zoom")}
                onChange={(event) => onZoomChange(Number(event.target.value))}
              />
            </label>
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
            <label className="settings-row settings-switch-row" title={t("show_root_folders_hint")}>
              <span className="settings-label-copy">
                <strong>{t("show_root_folders")}</strong>
                <small>{t("show_root_folders_hint")}</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-label={t("show_root_folders")}
                checked={showRootFolders}
                onChange={(event) => onShowRootFoldersChange(event.target.checked)}
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
