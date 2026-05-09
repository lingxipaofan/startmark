# 🔖 Pinmark

<a href="https://pinmark.01mvp.com">
  <img src="https://img.shields.io/badge/website-pinmark.01mvp.com-blue" alt="Website">
</a>
<img src="https://img.shields.io/github/v/release/makerjackie/pinmark" alt="Version">
<img src="https://img.shields.io/badge/license-MIT-green" alt="License">

> **Pinmark** — A simple, fast bookmark manager for Chrome.
>
> Organize, browse, and clean up your bookmarks with an intuitive grid interface.
>
> **Pinmark** — 简洁快速的 Chrome 书签管理器。
>
> 通过直观的导航界面，轻松整理、浏览和管理你的书签。

---

## 📸 Screenshot

![Pinmark](https://raw.githubusercontent.com/makerjackie/pinmark/main/website/screenshot.png)

> *Screenshot placeholder — replace with actual screenshot*

---

## ✨ Features / 功能特性

| English | 中文 |
|---------|------|
| Grid & List view — multi-column card navigation or classic sidebar + list | 导航模式 / 列表模式 — 多列卡片导航或传统侧边栏列表 |
| Drag & drop bookmarks and folders | 拖拽整理书签和文件夹 |
| Batch select + drag / delete / move | 多选批量拖拽、删除、移动 |
| Full-text search (⌘F) | 全文搜索 (⌘F) |
| Sort by folder or by creation time | 按文件夹或收藏时间排序 |
| Dark mode (persists preference) | 深色模式（自动记忆偏好） |
| Open all bookmarks in a folder (right-click) | 一键打开文件夹内全部书签（右键菜单） |
| Undo delete with toast notification | 撤销删除（Toast 通知） |
| Keyboard shortcuts: ⌘F, ⌘A, Delete, Esc | 键盘快捷键：⌘F、⌘A、Delete、Esc |
| Create new folders | 新建文件夹 |

---

## 🚀 Installation / 安装方法

### Chrome Web Store *(coming soon / 即将上架)*

- [ ] Chrome Web Store listing — placeholder

### Manual / 手动安装

1. **Download** the latest ZIP from the [releases page](https://github.com/makerjackie/pinmark/releases) or [pinmark.01mvp.com](https://pinmark.01mvp.com)
2. **Extract** the ZIP to a local folder
3. Open Chrome and go to `chrome://extensions`
4. Enable **Developer mode** (top-right corner)
5. Click **Load unpacked** and select the extracted folder
6. Click the 🔖 icon in the toolbar to open Pinmark

---

## 🛠️ Development / 开发

```bash
# Install dependencies
npm install

# Development mode (hot reload)
npm run dev

# Production build
npm run build

# Build and create ZIP
npm run build
cd .output/chrome-mv3 && zip -r ../pinmark.zip .
```

Built with [WXT](https://wxt.dev) + React 19 + TypeScript + Vite.

---

## 🎬 Demo / 演示视频

- **Bilibili**: *(coming soon / 即将上线)*

---

## 🗺️ Roadmap

- [x] Grid navigation mode
- [x] List mode with folder tree
- [x] Drag & drop (bookmarks & folders)
- [x] Batch operations
- [x] Search
- [x] Dark mode
- [x] Undo delete
- [x] Open all bookmarks
- [x] Time-sorted view
- [ ] Chrome Web Store release
- [ ] i18n / 国际化
- [ ] Bookmark import/export

---

## 📄 License

MIT © [makerjackie](https://github.com/makerjackie)
