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
    light_mode: "浅色模式",
    dark_mode: "深色模式",
    grid_view: "导航模式",
    list_view: "列表模式",
    grid: "导航",
    list: "列表",
    bookmark_bar: "书签栏",
    folder_empty: "这个文件夹是空的",
    no_matching: "没有匹配的书签",
    no_bookmarks: "暂无书签",
    sort_by_folder: "📁 按文件夹",
    sort_custom: "文件夹 / 原顺序",
    sort_name_asc: "名称 A-Z",
    sort_name_desc: "名称 Z-A",
    sort_alphabetical_hint: "再次点击可切换正序或倒序",
    sort_by_time: "🕐 按收藏时间",
    selected_items: "已选择 {count} 项",
    select_all: "☐ 全选",
    delete_selected: "🗑 删除选中",
    move_to: "📂 移动到...",
    cancel: "✕ 取消",
    untitled: "无标题",
    new_subfolder: "+ 新建子文件夹",
    delete_folder: "删除文件夹",
    delete_bookmark: "删除书签",
    open_all: "打开全部",
    undo: "撤销",
    new_folder: "+ 新建文件夹",
    select_folder_hint: "请从左侧选择一个文件夹",
    folder_name_prompt: "文件夹名称：",
    deleted_folder: "已删除文件夹「{title}」及其所有书签",
    delete_folder_failed: "删除文件夹失败",
    deleted_bookmarks: "已删除 {count} 个书签",
    deleted_bookmark_item: "已删除「{title}」",
    undo_failed: "撤销失败，请重试",
    opened_bookmarks: "已打开 {count} 个书签",
    empty_folders: "空文件夹: {count}",
    duplicates: "重复: {count}",
    bookmark_count: "({count} 个书签)",
    select_all_checkbox: "全选",
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
    edit_url: "编辑网址",
    rename_prompt: "新名称：",
    url_prompt: "新网址：",
    rename_failed: "重命名失败",
    edit_url_failed: "编辑网址失败",
    delete_confirm: "确定要删除选中的 {count} 项吗？",
    check_complete: "检查完成",
    links_ok: "全部有效 ✓",
    broken_found: "发现 {count} 个失效链接",
    select_broken: "选择失效链接",
    link_check_error: "链接检查出错",
    broken_link_delete_confirm: "确定要删除这 {count} 个失效链接吗？",
    recheck_broken: "重新检查失效",
    last_checked: "上次检查: {time}",
  },
  en: {
    total_bookmarks: "{count} bookmarks",
    search_placeholder: "Search bookmarks... (⌘F)",
    light_mode: "Light mode",
    dark_mode: "Dark mode",
    grid_view: "Grid view",
    list_view: "List view",
    grid: "Grid",
    list: "List",
    bookmark_bar: "Bookmarks Bar",
    folder_empty: "This folder is empty",
    no_matching: "No matching bookmarks",
    no_bookmarks: "No bookmarks yet",
    sort_by_folder: "📁 By Folder",
    sort_custom: "Folders / Chrome Order",
    sort_name_asc: "Name A-Z",
    sort_name_desc: "Name Z-A",
    sort_alphabetical_hint: "Click again to reverse the order",
    sort_by_time: "🕐 By Time",
    selected_items: "{count} selected",
    select_all: "☐ Select All",
    delete_selected: "🗑 Delete Selected",
    move_to: "📂 Move to...",
    cancel: "✕ Cancel",
    untitled: "Untitled",
    new_subfolder: "+ New Subfolder",
    delete_folder: "Delete Folder",
    delete_bookmark: "Delete Bookmark",
    open_all: "Open All",
    undo: "Undo",
    new_folder: "+ New Folder",
    select_folder_hint: "Please select a folder from the left",
    folder_name_prompt: "Folder name:",
    deleted_folder: 'Deleted folder "{title}" and all its bookmarks',
    delete_folder_failed: "Failed to delete folder",
    deleted_bookmarks: "Deleted {count} bookmarks",
    deleted_bookmark_item: 'Deleted "{title}"',
    undo_failed: "Undo failed. Please try again.",
    opened_bookmarks: "Opened {count} bookmarks",
    empty_folders: "Empty: {count}",
    duplicates: "Duplicates: {count}",
    bookmark_count: "({count} bookmarks)",
    select_all_checkbox: "Select All",
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
    edit_url: "Edit URL",
    rename_prompt: "New name:",
    url_prompt: "New URL:",
    rename_failed: "Failed to rename",
    edit_url_failed: "Failed to update URL",
    delete_confirm: "Delete {count} selected item(s)?",
    check_complete: "Check Complete",
    links_ok: "All valid ✓",
    broken_found: "Found {count} broken links",
    select_broken: "Select broken",
    link_check_error: "Link check error",
    broken_link_delete_confirm: "Delete {count} broken links?",
    recheck_broken: "Re-check broken",
    last_checked: "Last checked: {time}",
  },
  ja: {
    total_bookmarks: "ブックマーク {count} 件",
    search_placeholder: "ブックマークを検索... (⌘F)",
    light_mode: "ライトモード",
    dark_mode: "ダークモード",
    grid_view: "グリッド表示",
    list_view: "リスト表示",
    grid: "グリッド",
    list: "リスト",
    bookmark_bar: "ブックマークバー",
    folder_empty: "このフォルダは空です",
    no_matching: "一致するブックマークがありません",
    no_bookmarks: "ブックマークがありません",
    sort_by_folder: "📁 フォルダ順",
    sort_custom: "フォルダ / Chrome 順",
    sort_name_asc: "名前 A-Z",
    sort_name_desc: "名前 Z-A",
    sort_alphabetical_hint: "もう一度クリックすると昇順・降順が切り替わります",
    sort_by_time: "🕐 保存日時順",
    selected_items: "{count} 件を選択中",
    select_all: "☐ すべて選択",
    delete_selected: "🗑 選択を削除",
    move_to: "📂 移動...",
    cancel: "✕ キャンセル",
    untitled: "無題",
    new_subfolder: "+ 新規サブフォルダ",
    delete_folder: "フォルダを削除",
    delete_bookmark: "ブックマークを削除",
    open_all: "すべて開く",
    undo: "元に戻す",
    new_folder: "+ 新規フォルダ",
    select_folder_hint: "左側からフォルダを選択してください",
    folder_name_prompt: "フォルダ名：",
    deleted_folder: "フォルダ「{title}」とそのブックマークを削除しました",
    delete_folder_failed: "フォルダの削除に失敗しました",
    deleted_bookmarks: "{count} 件のブックマークを削除しました",
    deleted_bookmark_item: "「{title}」を削除しました",
    undo_failed: "元に戻せませんでした。もう一度お試しください",
    opened_bookmarks: "{count} 件のブックマークを開きました",
    empty_folders: "空フォルダ: {count}",
    duplicates: "重複: {count}",
    bookmark_count: "({count} 件)",
    select_all_checkbox: "すべて選択",
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
    edit_url: "URLを編集",
    rename_prompt: "新しい名前：",
    url_prompt: "新しいURL：",
    rename_failed: "名前の変更に失敗しました",
    edit_url_failed: "URLの更新に失敗しました",
    delete_confirm: "選択した {count} 件を削除しますか？",
    check_complete: "チェック完了",
    links_ok: "すべて有効 ✓",
    broken_found: "{count} 個の無効なリンクが見つかりました",
    select_broken: "無効なリンクを選択",
    link_check_error: "リンク確認エラー",
    broken_link_delete_confirm: "{count} 個の無効なリンクを削除しますか？",
    recheck_broken: "無効を再確認",
    last_checked: "最終確認: {time}",
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
