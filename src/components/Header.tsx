import React from "react";
import { Settings } from "lucide-react";
import { useI18n } from "../lib/i18n";
import SettingsModal from "./SettingsModal";

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
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

  React.useEffect(() => {
    const openSettings = () => setSettingsOpen(true);
    window.addEventListener("pinmark-open-settings", openSettings);
    return () => window.removeEventListener("pinmark-open-settings", openSettings);
  }, []);

  return (
    <header className="header">
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
          zoom={zoom}
          onZoomChange={onZoomChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </header>
  );
}
