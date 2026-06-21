# Pinmark New Tab

这是基于 [makerjackie/pinmark](https://github.com/makerjackie/pinmark) fork 的个人自用版本。Pinmark 原本是一个 Chrome 书签管理扩展，本仓库进一步将它调整为日常使用的新标签页书签导航。

本项目的定制设计、代码修改与测试均由 AI 辅助完成，目前以个人使用为主。

## 与原版的主要区别

1. **接管 Chrome 新标签页**

   打开 Chrome 新标签页时直接展示 Pinmark，无需再通过扩展图标进入书签管理页面。

2. **瀑布流式书签分组布局**

   导航视图采用 masonry-like multi-column layout（瀑布流式多列布局），不同高度的书签分组会自然向上排列，减少普通网格布局产生的大块空白。

## 个人增强功能

- **更自然的点击操作**：点击书签直接打开链接，仅点击左侧选择控件时才进入批量选择。
- **多种显示顺序**：支持 Chrome 原顺序、名称 A-Z、名称 Z-A 和收藏时间排序，左右区域保持同步并自动记住选择。
- **文件夹快速定位**：点击左侧文件夹会滚动定位右侧对应分组，并高亮完整的父级路径；点击右侧空白可清除选中状态。
- **原位重命名**：双击左侧普通文件夹即可直接编辑名称，Enter 或失焦保存，Esc 取消。
- **可选精简标题**：通过全局开关移除通知数字、重复站名和冗余站点后缀，只改变显示文字，不修改 Chrome 中的原始书签名称。
- **可靠的删除撤销**：批量删除、右键删除、快捷键删除及文件夹删除均可恢复原目录和位置。
- **低干扰失效链接提示**：弱化失效链接的视觉强调，并及时清理已删除书签的检测状态。

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
