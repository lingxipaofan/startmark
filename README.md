[English](#english) | [中文](#chinese)

---

<a id="english"></a>
## English

# Startmark

Your bookmarks as a new tab page. Masonry layout, drag-and-drop ordering synced to Chrome.

### Highlights

- **Masonry layout** — Bookmarks grouped by folder in a multi-column waterfall, naturally filling gaps.
- **Drag-and-drop sort** — Reorder bookmarks by dragging. Changes write directly to Chrome's native bookmark order, cross-folder moves included.
- **Inline edit dialog** — Rename, edit URLs, or create folders via modal dialogs — no browser `prompt()`.
- **Smart title cleanup** — Auto-hides notification badges, duplicate site names, and redundant suffixes.
- **Rich context menu** — Open in incognito / tab group, batch open all in a folder, rename/delete folders.
- **UI zoom** — Adjustable 75%–125% scale, persisted locally.
- **Root folder toggle** — Show or hide "Bookmarks bar" and "Other bookmarks" as top-level blocks.
- **Broken link detection** — One-click scan with unobtrusive broken-link markers.

### Development

```bash
npm ci
npm run dev
npm run build
npm test
```

Stack: WXT · React · TypeScript · Vite

### Install

Build then load `.output/chrome-mv3` as an unpacked extension at `chrome://extensions/` (Developer mode required).

### Known issues

- [ ] Folder title flickers during resize animation

### Roadmap

- [ ] Improve folder drag-and-drop UX
- [x] Support hiding specific folders
- [ ] Fix zoom animation layout jitter
- [ ] Click search button to select default search engine
- [ ] Redesign large folder style
- [ ] Add animation for other folders after folder resize

### Credits

Forked from [pinmark](https://github.com/lingxipaofan/pinmark), MIT licensed.

---

<a id="chinese"></a>
## 中文

# Startmark

打开新标签即见书签，瀑布流布局，拖拽排序实时同步 Chrome。

### 亮点

- **瀑布流布局** — 按文件夹分组的 masonry 布局，不同高度的列自然对齐。
- **拖拽排序** — 拖拽书签调整顺序，直接写入 Chrome 书签顺序，支持跨文件夹移动。
- **内联编辑弹窗** — 重命名、改 URL、新建文件夹均使用模态弹窗，告别浏览器 `prompt()`。
- **智能精简标题** — 自动隐藏通知数字、重复站名、冗余后缀。
- **丰富的右键菜单** — 隐身窗口打开 / 标签页组批量打开 / 文件夹增删改。
- **界面缩放** — 75% ~ 125% 自由调节，偏好持久化。
- **根文件夹开关** — 「书签栏」和「其他书签」可独立显示为顶层大块。
- **失效链接检测** — 一键扫描，失效标记低调不打扰。

### 开发

```bash
npm ci
npm run dev
npm run build
npm test
```

技术栈：WXT · React · TypeScript · Vite

### 安装

构建后在 Chrome 打开 `chrome://extensions/`，开启「开发者模式」，加载 `.output/chrome-mv3` 目录。

### 已知问题

- [ ] 缩放文件夹时标题闪动

### 计划

- [ ] 优化文件夹拖拽方式
- [x] 支持隐藏特定文件夹
- [ ] 修复文件夹缩放时动画/布局抖动
- [ ] 点击搜索按钮选择默认搜索引擎
- [ ] 更改大文件夹样式
- [ ] 添加文件夹缩放后其余文件夹的动画

### 致谢

Fork from [pinmark](https://github.com/lingxipaofan/pinmark)，MIT 协议。
