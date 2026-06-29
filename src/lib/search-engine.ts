export const SEARCH_ENGINE_KEY = "startmark-search-engine";
export const CUSTOM_SEARCH_ENGINES_KEY = "startmark-custom-search-engines";
export const LEGACY_CUSTOM_SEARCH_TEMPLATE_KEY = "startmark-custom-search-template";

export type BuiltInSearchEngineId = "browser" | "google" | "bing" | "baidu" | "duckduckgo";
export type CustomSearchEngineId = `custom:${string}`;
export type SearchEngineId = BuiltInSearchEngineId | CustomSearchEngineId;

export interface SearchEngineOption {
  id: SearchEngineId;
  label: string;
  template: string | null;
  custom?: boolean;
}

export interface CustomSearchEngine {
  id: CustomSearchEngineId;
  title: string;
  template: string;
}

export const BUILT_IN_SEARCH_ENGINES: SearchEngineOption[] = [
  { id: "browser", label: "browser_default_search", template: null },
  { id: "google", label: "Google", template: "https://www.google.com/search?q=%s" },
  { id: "bing", label: "Bing", template: "https://www.bing.com/search?q=%s" },
  { id: "baidu", label: "百度", template: "https://www.baidu.com/s?wd=%s" },
  { id: "duckduckgo", label: "DuckDuckGo", template: "https://duckduckgo.com/?q=%s" },
];

export function createCustomSearchEngine(): CustomSearchEngine {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id: `custom:${randomPart}`,
    title: "",
    template: "",
  };
}

export function isSearchEngineId(value: string | null): value is SearchEngineId {
  if (!value) return false;
  return BUILT_IN_SEARCH_ENGINES.some((engine) => engine.id === value) || value.startsWith("custom:");
}

export function readSearchEngine(): SearchEngineId {
  try {
    const stored = localStorage.getItem(SEARCH_ENGINE_KEY);
    if (stored === "custom" && localStorage.getItem(LEGACY_CUSTOM_SEARCH_TEMPLATE_KEY)) {
      return "custom:legacy";
    }
    return isSearchEngineId(stored) ? stored : "browser";
  } catch {
    return "browser";
  }
}

export function readCustomSearchEngines(): CustomSearchEngine[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_SEARCH_ENGINES_KEY) || "[]");
    const engines = Array.isArray(parsed)
      ? parsed
          .filter((engine): engine is CustomSearchEngine =>
            typeof engine?.id === "string" &&
            engine.id.startsWith("custom:") &&
            typeof engine.title === "string" &&
            typeof engine.template === "string"
          )
          .map((engine) => ({
            id: engine.id,
            title: engine.title,
            template: engine.template,
          }))
      : [];

    const legacyTemplate = localStorage.getItem(LEGACY_CUSTOM_SEARCH_TEMPLATE_KEY);
    const hasLegacyEngine = engines.some((engine) => engine.id === "custom:legacy");
    if (legacyTemplate && !hasLegacyEngine) {
      return [
        ...engines,
        {
          id: "custom:legacy",
          title: "Custom",
          template: legacyTemplate,
        },
      ];
    }

    return engines;
  } catch {
    return [];
  }
}

export function getSearchEngineOptions(customEngines: CustomSearchEngine[] = []): SearchEngineOption[] {
  return [
    ...BUILT_IN_SEARCH_ENGINES,
    ...customEngines.map((engine) => ({
      id: engine.id,
      label: engine.title.trim() || "custom_search_engine",
      template: engine.template,
      custom: true,
    })),
  ];
}

export function getSearchEngineOption(
  id: SearchEngineId,
  customEngines: CustomSearchEngine[] = []
): SearchEngineOption {
  return getSearchEngineOptions(customEngines).find((engine) => engine.id === id) ||
    BUILT_IN_SEARCH_ENGINES[0];
}

export function buildSearchUrl(template: string, query: string): string {
  const encodedQuery = encodeURIComponent(query);
  const trimmedTemplate = template.trim();
  if (!trimmedTemplate) {
    return `https://www.google.com/search?q=${encodedQuery}`;
  }

  if (trimmedTemplate.includes("%s")) {
    return trimmedTemplate.replaceAll("%s", encodedQuery);
  }

  const separator = trimmedTemplate.includes("?") ? "&" : "?";
  return `${trimmedTemplate}${separator}q=${encodedQuery}`;
}
