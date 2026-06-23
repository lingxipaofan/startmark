# Pinmark New Tab

这是基于 [makerjackie/pinmark](https://github.com/makerjackie/pinmark) fork 的个人自用版本。Pinmark 原本是一个 Chrome 书签管理扩展，本仓库进一步将它调整为日常使用的新标签页书签导航。

本项目的定制设计、代码修改与测试均由 AI 辅助完成，目前以个人使用为主。

## 与原版的主要区别

1. **接管 Chrome 新标签页**

   打开 Chrome 新标签页时直接展示 Pinmark，无需再通过扩展图标进入书签管理页面。

2. **瀑布流式书签分组布局**

   导航视图采用 masonry-like multi-column layout（瀑布流式多列布局），不同高度的书签分组会自然向上排列，减少普通网格布局产生的大块空白。

## 个人增强功能

- **更自然的点击操作**：点击书签直接在当前标签页打开链接，无多选负担。
- **多种显示顺序**：支持 Chrome 原顺序、名称 A-Z、名称 Z-A 和收藏时间排序，可通过排序菜单切换并自动记住选择。
- **可选精简标题**：通过设置面板开关移除通知数字、重复站名和冗余站点后缀，只改变显示文字，不修改 Chrome 中的原始书签名称。
- **可靠的删除撤销**：右键删除和快捷键删除均可恢复原目录和位置。
- **低干扰失效链接提示**：弱化失效链接的视觉强调，并及时清理已删除书签的检测状态。
- **统一设置面板**：主题（明/暗）、界面语言、精简标题开关统一收入右上角设置弹窗，Header 更简洁。
- **右键菜单**：书签支持在新窗口打开、重命名、编辑 URL 和删除。

## 2026-06-23 重构说明

今日对项目进行了一次较大规模的架构清理：

- **移除侧边栏与列表视图**：删除 `FolderTree`、`BookmarkList`、`ToolBar` 三个组件，专注于单一的 Grid 瀑布流视图，简化了整体状态管理。
- **新增 SettingsModal**：将原 Header 中内联的主题切换、语言选择、精简标题开关，整合到一个由齿轮按钮唤起的模态弹窗（支持 Escape 和点击背景关闭），Header 因此变得更干净。
- **简化 App 状态**：移除多选逻辑（`selectedBookmarkIds`、`toggleSelectAll`）、`viewMode` 状态、`emptyFolders` 和 `duplicateBookmarks` 等复杂状态，降低维护成本。
- **简化上下文菜单**：`ContextMenu` 不再区分 folder/bookmark 类型，统一提供「在新窗口打开 / 重命名 / 编辑 URL / 删除」四项操作。
- **移除 handleInlineRename**：双击左侧文件夹内联重命名功能随侧边栏一并移除；重命名保留为右键菜单操作。
- **测试文件同步更新**：`tests/bookmark-utils.test.ts` 随工具函数简化一并清理；新增 `tests/header-settings.test.tsx`，覆盖设置弹窗的打开、关闭和即时生效行为。

## 开发

```bash
npm ci
npm run dev
npm run build
npm test
```

项目基于 WXT、React、TypeScript 和 Vite。

## 安装本地版本

构建后在 Chrome 中打开：

```text
chrome://extensions/
```

然后开启「开发者模式」，选择「加载已解压的扩展程序」，加载：

```text
.output/chrome-mv3
```

更新代码并重新构建后，需要在扩展管理页点击「重新加载」。

## 上游项目

- 原项目：[makerjackie/pinmark](https://github.com/makerjackie/pinmark)
- 本仓库：[lingxipaofan/pinmark](https://github.com/lingxipaofan/pinmark)

## 说明

这是个人自用的 AI 定制版本，不代表原项目作者的设计取向。如需原版或更通用的实现，请优先参考上游仓库。

## License

MIT. 原始项目版权归原作者所有。
