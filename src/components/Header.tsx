import React from "react";
import { Settings } from "lucide-react";
import { useI18n } from "../lib/i18n";
import SettingsModal from "./SettingsModal";

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  bookmarkCount: number;
  darkMode: boolean;
  onDarkModeChange: (v: boolean) => void;
  simplifyTitles: boolean;
  onSimplifyTitlesChange: (value: boolean) => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
}

export default function Header({
  searchQuery,
  onSearchChange,
  bookmarkCount,
  darkMode,
  onDarkModeChange,
  simplifyTitles,
  onSimplifyTitlesChange,
  searchRef,
}: Props) {
  const { t } = useI18n();
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  return (
    <header className="header">
      <h1 className="header-title">Pinmark</h1>
      <span className="header-count">{t("total_bookmarks", { count: bookmarkCount })}</span>
      <div className="header-search">
        <input
          ref={searchRef}
          type="text"
          placeholder={t("search_placeholder")}
          aria-label={t("search_placeholder")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
      </div>
      <button
        type="button"
        className="settings-button"
        onClick={() => setSettingsOpen(true)}
        aria-label={t("settings")}
        title={t("settings")}
      >
        <Settings size={18} aria-hidden="true" />
      </button>
      {settingsOpen && (
        <SettingsModal
          darkMode={darkMode}
          onDarkModeChange={onDarkModeChange}
          simplifyTitles={simplifyTitles}
          onSimplifyTitlesChange={onSimplifyTitlesChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </header>
  );
}
