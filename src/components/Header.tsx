import React from "react";
import { Check, Search, Settings } from "lucide-react";
import { useI18n } from "../lib/i18n";
import {
  getSearchEngineOption,
  getSearchEngineOptions,
  type CustomSearchEngine,
  type SearchEngineId,
} from "../lib/search-engine";
import SettingsModal from "./SettingsModal";

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: (q: string) => void;
  searchEngine: SearchEngineId;
  onSearchEngineChange: (value: SearchEngineId) => void;
  customSearchEngines: CustomSearchEngine[];
  onCustomSearchEnginesChange: (value: CustomSearchEngine[]) => void;
  darkMode: boolean;
  onDarkModeChange: (v: boolean) => void;
  simplifyTitles: boolean;
  onSimplifyTitlesChange: (value: boolean) => void;
  zoom?: number;
  onZoomChange?: (value: number) => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
}

export default function Header({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  searchEngine,
  onSearchEngineChange,
  customSearchEngines,
  onCustomSearchEnginesChange,
  darkMode,
  onDarkModeChange,
  simplifyTitles,
  onSimplifyTitlesChange,
  zoom = 1,
  onZoomChange = () => undefined,
  searchRef,
}: Props) {
  const { t } = useI18n();
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [engineMenuOpen, setEngineMenuOpen] = React.useState(false);
  const engineMenuRef = React.useRef<HTMLDivElement>(null);
  const searchEngineOptions = getSearchEngineOptions(customSearchEngines);
  const searchEngineOption = getSearchEngineOption(searchEngine, customSearchEngines);
  const searchEngineLabel = searchEngineOption.label.includes("_")
    ? t(searchEngineOption.label)
    : searchEngineOption.label;

  React.useEffect(() => {
    const openSettings = () => setSettingsOpen(true);
    window.addEventListener("startmark-open-settings", openSettings);
    return () => window.removeEventListener("startmark-open-settings", openSettings);
  }, []);

  React.useEffect(() => {
    if (!engineMenuOpen) return;
    const closeMenu = (event: MouseEvent) => {
      if (engineMenuRef.current?.contains(event.target as Node)) return;
      setEngineMenuOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [engineMenuOpen]);

  return (
    <header className="header">
      <div className="header-brand" aria-hidden="true">{searchEngineLabel}</div>
      <form
        className="header-search"
        onSubmit={(event) => {
          event.preventDefault();
          onSearchSubmit(searchQuery);
        }}
      >
        <div className="search-engine-picker" ref={engineMenuRef}>
          <button
            type="button"
            className="search-engine-button"
            aria-label={t("select_search_engine")}
            title={searchEngineLabel}
            aria-haspopup="menu"
            aria-expanded={engineMenuOpen}
            onClick={() => setEngineMenuOpen((open) => !open)}
          >
            <Search size={18} aria-hidden="true" />
          </button>
          {engineMenuOpen && (
            <div className="search-engine-menu" role="menu">
              {searchEngineOptions.map((engine) => {
                const label = engine.label.includes("_") ? t(engine.label) : engine.label;
                return (
                  <button
                    key={engine.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={searchEngine === engine.id}
                    className="search-engine-menu-item"
                    onClick={() => {
                      onSearchEngineChange(engine.id);
                      setEngineMenuOpen(false);
                    }}
                  >
                    <span className="search-engine-menu-check" aria-hidden="true">
                      {searchEngine === engine.id && <Check size={14} />}
                    </span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <input
          ref={searchRef}
          type="text"
          placeholder={t("search_placeholder")}
          aria-label={t("search_placeholder")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
        <button
          type="button"
          className="settings-button"
          onClick={() => setSettingsOpen(true)}
          aria-label={t("settings")}
          title={t("settings")}
        >
          <Settings size={18} aria-hidden="true" />
        </button>
      </form>
      {settingsOpen && (
        <SettingsModal
          darkMode={darkMode}
          onDarkModeChange={onDarkModeChange}
          simplifyTitles={simplifyTitles}
          onSimplifyTitlesChange={onSimplifyTitlesChange}
          searchEngine={searchEngine}
          onSearchEngineChange={onSearchEngineChange}
          customSearchEngines={customSearchEngines}
          onCustomSearchEnginesChange={onCustomSearchEnginesChange}
          zoom={zoom}
          onZoomChange={onZoomChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </header>
  );
}
