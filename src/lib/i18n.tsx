import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

export type Locale = "zh-CN" | "en" | "ja";

const STORAGE_KEY = "pinmark-locale";

const LOCALE_LABELS: Record<Locale, string> = {
  "zh-CN": "中文",
  en: "English",
  ja: "日本語",
};

type Messages = Record<string, string>;

const messages: Record<Locale, Messages> = {
  "zh-CN": {
    total_bookmarks: "共 {count} 个书签",
    search_placeholder: "搜索书签... (⌘F)",
    settings: "设置",
    close_settings: "关闭设置",
    appearance: "外观",
    display: "显示",
    light_mode: "浅色模式",
    dark_mode: "深色模式",
    simplify_titles: "精简标题",
    simplify_titles_hint: "仅精简显示，不修改原始书签名称",
    folder_empty: "这个文件夹是空的",
    no_matching: "没有匹配的书签",
    no_bookmarks: "暂无书签",
    sort_by_folder: "📁 按文件夹",
    sort_custom: "文件夹 / 原顺序",
    sort_options: "排序方式",
    sort_name_asc: "名称 A-Z",
    sort_name_desc: "名称 Z-A",
    sort_alphabetical_hint: "再次点击可切换正序或倒序",
    sort_by_time: "🕐 按收藏时间",
    untitled: "无标题",
    new_subfolder: "+ 新建子文件夹",
    delete_folder: "删除文件夹",
    delete_bookmark: "删除书签",
    undo: "撤销",
    folder_name_prompt: "文件夹名称：",
    deleted_folder: "已删除文件夹「{title}」及其所有书签",
    delete_folder_failed: "删除文件夹失败",
    deleted_bookmark_item: "已删除「{title}」",
    undo_failed: "撤销失败，请重试",
    delete_with_count: "🗑 删除选中 ({count})",
    today: "今天",
    yesterday: "昨天",
    days_ago: "{n} 天前",
    weeks_ago: "{n} 周前",
    months_ago: "{n} 个月前",
    years_ago: "{n} 年前",
    this_week: "本周",
    last_year: "去年",
    year_before_last: "前年",
    bookmarked: "收藏: {time}",
    language: "语言",
    check_links: "检查链接失效",
    checking_links: "正在检查 {count} 个链接...",
    link_valid: "有效",
    link_broken: "失效",
    link_checking: "检查中...",
    rename: "重命名",
    open_new_window: "在新窗口打开",
    edit_url: "编辑网址",
    rename_prompt: "新名称：",
    url_prompt: "新网址：",
    rename_failed: "重命名失败",
    edit_url_failed: "编辑网址失败",
    delete_confirm: "确定要删除 {count} 项吗？",
    check_complete: "检查完成",
    links_ok: "全部有效 ✓",
    broken_found: "发现 {count} 个失效链接",
    link_check_error: "链接检查出错",
  },
  en: {
    total_bookmarks: "{count} bookmarks",
    search_placeholder: "Search bookmarks... (⌘F)",
    settings: "Settings",
    close_settings: "Close settings",
    appearance: "Appearance",
    display: "Display",
    light_mode: "Light mode",
    dark_mode: "Dark mode",
    simplify_titles: "Short titles",
    simplify_titles_hint: "Simplify display only; original bookmark names stay unchanged",
    folder_empty: "This folder is empty",
    no_matching: "No matching bookmarks",
    no_bookmarks: "No bookmarks yet",
    sort_by_folder: "📁 By Folder",
    sort_custom: "Folders / Chrome Order",
    sort_options: "Sort options",
    sort_name_asc: "Name A-Z",
    sort_name_desc: "Name Z-A",
    sort_alphabetical_hint: "Click again to reverse the order",
    sort_by_time: "🕐 By Time",
    untitled: "Untitled",
    new_subfolder: "+ New Subfolder",
    delete_folder: "Delete Folder",
    delete_bookmark: "Delete Bookmark",
    undo: "Undo",
    folder_name_prompt: "Folder name:",
    deleted_folder: 'Deleted folder "{title}" and all its bookmarks',
    delete_folder_failed: "Failed to delete folder",
    deleted_bookmark_item: 'Deleted "{title}"',
    undo_failed: "Undo failed. Please try again.",
    delete_with_count: "🗑 Delete Selected ({count})",
    today: "Today",
    yesterday: "Yesterday",
    days_ago: "{n} days ago",
    weeks_ago: "{n} weeks ago",
    months_ago: "{n} months ago",
    years_ago: "{n} years ago",
    this_week: "This Week",
    last_year: "Last Year",
    year_before_last: "Two Years Ago",
    bookmarked: "Bookmarked: {time}",
    language: "Language",
    check_links: "Check Links",
    checking_links: "Checking {count} links...",
    link_valid: "Valid",
    link_broken: "Broken",
    link_checking: "Checking...",
    rename: "Rename",
    open_new_window: "Open in new window",
    edit_url: "Edit URL",
    rename_prompt: "New name:",
    url_prompt: "New URL:",
    rename_failed: "Failed to rename",
    edit_url_failed: "Failed to update URL",
    delete_confirm: "Delete {count} item(s)?",
    check_complete: "Check Complete",
    links_ok: "All valid ✓",
    broken_found: "Found {count} broken links",
    link_check_error: "Link check error",
  },
  ja: {
    total_bookmarks: "ブックマーク {count} 件",
    search_placeholder: "ブックマークを検索... (⌘F)",
    settings: "設定",
    close_settings: "設定を閉じる",
    appearance: "外観",
    display: "表示",
    light_mode: "ライトモード",
    dark_mode: "ダークモード",
    simplify_titles: "短いタイトル",
    simplify_titles_hint: "表示のみを簡略化し、元のブックマーク名は変更しません",
    folder_empty: "このフォルダは空です",
    no_matching: "一致するブックマークがありません",
    no_bookmarks: "ブックマークがありません",
    sort_by_folder: "📁 フォルダ順",
    sort_custom: "フォルダ / Chrome 順",
    sort_options: "並べ替え",
    sort_name_asc: "名前 A-Z",
    sort_name_desc: "名前 Z-A",
    sort_alphabetical_hint: "もう一度クリックすると昇順・降順が切り替わります",
    sort_by_time: "🕐 保存日時順",
    untitled: "無題",
    new_subfolder: "+ 新規サブフォルダ",
    delete_folder: "フォルダを削除",
    delete_bookmark: "ブックマークを削除",
    undo: "元に戻す",
    folder_name_prompt: "フォルダ名：",
    deleted_folder: "フォルダ「{title}」とそのブックマークを削除しました",
    delete_folder_failed: "フォルダの削除に失敗しました",
    deleted_bookmark_item: "「{title}」を削除しました",
    undo_failed: "元に戻せませんでした。もう一度お試しください",
    delete_with_count: "🗑 選択を削除 ({count})",
    today: "今日",
    yesterday: "昨日",
    days_ago: "{n} 日前",
    weeks_ago: "{n} 週間前",
    months_ago: "{n} ヶ月前",
    years_ago: "{n} 年前",
    this_week: "今週",
    last_year: "昨年",
    year_before_last: "一昨年",
    bookmarked: "保存日時: {time}",
    language: "言語",
    check_links: "リンクをチェック",
    checking_links: "{count} 個のリンクを確認中...",
    link_valid: "有効",
    link_broken: "無効",
    link_checking: "確認中...",
    rename: "名前を変更",
    open_new_window: "新しいウィンドウで開く",
    edit_url: "URLを編集",
    rename_prompt: "新しい名前：",
    url_prompt: "新しいURL：",
    rename_failed: "名前の変更に失敗しました",
    edit_url_failed: "URLの更新に失敗しました",
    delete_confirm: "{count} 件を削除しますか？",
    check_complete: "チェック完了",
    links_ok: "すべて有効 ✓",
    broken_found: "{count} 個の無効なリンクが見つかりました",
    link_check_error: "リンク確認エラー",
  },
};

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in messages) return stored as Locale;
  } catch { /* localStorage unavailable */ }
  const lang = (navigator.language || "en").toLowerCase();
  if (lang.startsWith("zh")) return "zh-CN";
  if (lang.startsWith("ja")) return "ja";
  return "en";
}

export function formatMessage(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`
  );
}

export function formatRelativeTime(ts: number, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return t("today");
  if (days === 1) return t("yesterday");
  if (days < 7) return t("days_ago", { n: days });
  if (days < 30) return t("weeks_ago", { n: Math.floor(days / 7) });
  if (days < 365) return t("months_ago", { n: Math.floor(days / 30) });
  return t("years_ago", { n: Math.floor(days / 365) });
}

export function timeBucket(ts: number, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  if (days === 0) return t("today");
  if (days === 1) return t("yesterday");
  if (days < 7) return t("this_week");
  if (months < 1) return t("days_ago", { n: days });
  if (years === 0) return t("months_ago", { n: months });
  if (years === 1) return t("last_year");
  if (years === 2) return t("year_before_last");
  return t("years_ago", { n: years });
}

interface I18nContextValue {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
  locales: { code: Locale; label: string }[];
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const template = messages[locale]?.[key];
      if (template === undefined) {
        // Fallback: try English
        const fallback = messages.en[key];
        return fallback ? formatMessage(fallback, vars) : key;
      }
      return formatMessage(template, vars);
    },
    [locale]
  );

  const localeList = useMemo(
    () => Object.entries(LOCALE_LABELS).map(([code, label]) => ({
      code: code as Locale,
      label,
    })),
    []
  );

  const contextValue = useMemo(
    () => ({ locale, t, setLocale, locales: localeList }),
    [locale, localeList]
  );

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <I18nProvider>");
  return ctx;
}
