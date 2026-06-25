import puppeteer from "puppeteer-core";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.resolve(ROOT, "dist-website");
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Build a standalone HTML page that mimics the Startmark UI in grid view
function buildGridPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Startmark - Grid View</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --bg: #f5f7fa;
  --surface: #fff;
  --text: #1a1a2e;
  --text-secondary: #666;
  --text-muted: #999;
  --border: #e8ecf0;
  --accent: #4a90d9;
  --sidebar-bg: #fff;
  --sidebar-hover: #f0f4f9;
  --sidebar-active: #e3edf7;
  --folder-width: 220px;
  --shadow: 0 1px 4px rgba(0,0,0,0.04);
}
body {
  font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background: var(--bg);
  color: var(--text);
  overflow: hidden; height: 100vh;
}
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px; background: var(--surface);
  border-bottom: 1px solid var(--border); height: 52px;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-left h1 { font-size: 16px; font-weight: 600; color: var(--accent); }
.header-left span { font-size: 12px; color: var(--text-muted); }
.search-box { display: flex; align-items: center; gap: 6px; background: var(--bg); border-radius: 8px; padding: 6px 12px; width: 240px; }
.search-box input { border: none; background: none; outline: none; font-size: 13px; width: 100%; color: var(--text); }
.search-box .kbd { font-size: 10px; color: var(--text-muted); background: var(--surface); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border); }
.header-right { display: flex; align-items: center; gap: 10px; }
.header-right .count { font-size: 12px; color: var(--text-muted); }
.mode-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); font-size: 12px; cursor: pointer; color: var(--text); }
.mode-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.main-layout { display: flex; height: calc(100vh - 52px); }
.folder-panel { width: var(--folder-width); background: var(--sidebar-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
.folder-tree { flex: 1; overflow-y: auto; padding: 8px; }
.folder-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.folder-item:hover { background: var(--sidebar-hover); }
.folder-item.active { background: var(--sidebar-active); color: var(--accent); font-weight: 500; }
.folder-item .icon { font-size: 14px; }
.folder-item .badge { margin-left: auto; font-size: 11px; color: var(--text-muted); background: var(--bg); padding: 0 6px; border-radius: 4px; }
.grid-layout { flex: 1; overflow-y: auto; display: flex; gap: 24px; padding: 24px; }
.grid-column { min-width: 200px; max-width: 260px; flex-shrink: 0; }
.grid-column h3 { font-size: 13px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; }
.grid-column h3 .count { font-weight: 400; font-size: 11px; color: var(--text-muted); }
.grid-cards { display: flex; flex-direction: column; gap: 6px; }
.grid-card { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--surface); border-radius: 8px; box-shadow: var(--shadow); border: 1px solid var(--border); cursor: pointer; transition: all .1s; }
.grid-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.08); transform: translateY(-1px); }
.grid-card img { width: 16px; height: 16px; border-radius: 2px; flex-shrink: 0; }
.grid-card .title { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.btn-new { margin: 8px; padding: 6px; border-radius: 6px; border: 1px dashed var(--border); background: none; font-size: 12px; color: var(--text-muted); cursor: pointer; text-align: center; }
.btn-new:hover { border-color: var(--accent); color: var(--accent); }
</style>
</head>
<body>
<div class="header">
  <div class="header-left"><h1>🔖 Startmark</h1><span>v0.1</span></div>
  <div class="search-box">
    <span style="opacity:.4">🔍</span>
    <input type="text" placeholder="搜索书签..." value=""/>
    <span class="kbd">⌘F</span>
  </div>
  <div class="header-right">
    <span class="count">23 个书签</span>
    <button class="mode-btn active">导航模式</button>
    <button class="mode-btn">列表模式</button>
    <button title="深色模式" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);font-size:14px;cursor:pointer">🌙</button>
  </div>
</div>
<div class="main-layout">
  <div class="folder-panel">
    <div class="folder-tree">
      <div class="folder-item active"><span class="icon">📂</span> 书签栏 <span class="badge">23</span></div>
      <div class="folder-item"><span class="icon">📁</span> 其他书签 <span class="badge">4</span></div>
    </div>
    <div class="btn-new">+ 新建文件夹</div>
  </div>
  <div class="grid-layout">
    <div class="grid-column">
      <h3>📂 工作 <span class="count">· 6</span></h3>
      <div class="grid-cards">
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=notion.so&sz=32" alt=""><span class="title">Notion</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=figma.com&sz=32" alt=""><span class="title">Figma</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=linear.app&sz=32" alt=""><span class="title">Linear</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=slack.com&sz=32" alt=""><span class="title">Slack</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=github.com&sz=32" alt=""><span class="title">GitHub</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=vercel.com&sz=32" alt=""><span class="title">Vercel</span></div>
      </div>
    </div>
    <div class="grid-column">
      <h3>📖 学习 <span class="count">· 4</span></h3>
      <div class="grid-cards">
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=developer.mozilla.org&sz=32" alt=""><span class="title">MDN Web Docs</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=react.dev&sz=32" alt=""><span class="title">React Documentation</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=typescriptlang.org&sz=32" alt=""><span class="title">TypeScript Handbook</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=wxt.dev&sz=32" alt=""><span class="title">WXT Framework Docs</span></div>
      </div>
    </div>
    <div class="grid-column">
      <h3>🎮 生活 <span class="count">· 4</span></h3>
      <div class="grid-cards">
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=youtube.com&sz=32" alt=""><span class="title">YouTube</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=music.apple.com&sz=32" alt=""><span class="title">Apple Music</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=x.com&sz=32" alt=""><span class="title">X (Twitter)</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=github.com&sz=32" alt=""><span class="title">GitHub Trending</span></div>
      </div>
    </div>
    <div class="grid-column">
      <h3>📰 阅读 <span class="count">· 5</span></h3>
      <div class="grid-cards">
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=news.ycombinator.com&sz=32" alt=""><span class="title">Hacker News</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=alistapart.com&sz=32" alt=""><span class="title">A List Apart</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=smashingmagazine.com&sz=32" alt=""><span class="title">Smashing Magazine</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=css-tricks.com&sz=32" alt=""><span class="title">CSS-Tricks</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=dev.to&sz=32" alt=""><span class="title">Dev.to</span></div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

function buildListPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Startmark - List View</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --bg: #f5f7fa;
  --surface: #fff;
  --text: #1a1a2e;
  --text-secondary: #666;
  --text-muted: #999;
  --border: #e8ecf0;
  --accent: #4a90d9;
  --sidebar-bg: #fff;
  --sidebar-hover: #f0f4f9;
  --sidebar-active: #e3edf7;
  --folder-width: 220px;
  --shadow: 0 1px 4px rgba(0,0,0,0.04);
}
body {
  font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background: var(--bg);
  color: var(--text);
  overflow: hidden; height: 100vh;
}
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px; background: var(--surface);
  border-bottom: 1px solid var(--border); height: 52px;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-left h1 { font-size: 16px; font-weight: 600; color: var(--accent); }
.header-left span { font-size: 12px; color: var(--text-muted); }
.search-box { display: flex; align-items: center; gap: 6px; background: var(--bg); border-radius: 8px; padding: 6px 12px; width: 240px; }
.search-box input { border: none; background: none; outline: none; font-size: 13px; width: 100%; color: var(--text); }
.search-box .kbd { font-size: 10px; color: var(--text-muted); background: var(--surface); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border); }
.header-right { display: flex; align-items: center; gap: 10px; }
.header-right .count { font-size: 12px; color: var(--text-muted); }
.mode-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); font-size: 12px; cursor: pointer; color: var(--text); }
.mode-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.main-layout { display: flex; height: calc(100vh - 52px); }
.folder-panel { width: var(--folder-width); background: var(--sidebar-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
.folder-tree { flex: 1; overflow-y: auto; padding: 8px; }
.folder-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.folder-item:hover { background: var(--sidebar-hover); }
.folder-item.active { background: var(--sidebar-active); color: var(--accent); font-weight: 500; }
.folder-item .icon { font-size: 14px; }
.folder-item .badge { margin-left: auto; font-size: 11px; color: var(--text-muted); background: var(--bg); padding: 0 6px; border-radius: 4px; }
.folder-item .arrow { margin-left: auto; font-size: 10px; opacity: .5; }
.bookmark-panel { flex: 1; display: flex; flex-direction: column; }
.toolbar { display: flex; align-items: center; gap: 12px; padding: 8px 20px; border-bottom: 1px solid var(--border); background: var(--surface); font-size: 13px; }
.toolbar .title { font-weight: 600; }
.toolbar .info { color: var(--text-muted); }
.toolbar .actions { margin-left: auto; display: flex; gap: 6px; }
.toolbar .actions button { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); font-size: 12px; cursor: pointer; }
.toolbar .actions button:hover { border-color: var(--accent); color: var(--accent); }
.bookmark-list { flex: 1; overflow-y: auto; padding: 8px 20px; }
.list-item { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.list-item:hover { background: var(--surface); }
.list-item input[type="checkbox"] { margin: 0; }
.list-item img { width: 16px; height: 16px; border-radius: 2px; }
.list-item .title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.list-item .domain { font-size: 11px; color: var(--text-muted); }
.list-item .time { font-size: 11px; color: var(--text-muted); }
.btn-new { margin: 8px; padding: 6px; border-radius: 6px; border: 1px dashed var(--border); background: none; font-size: 12px; color: var(--text-muted); cursor: pointer; text-align: center; }
.btn-new:hover { border-color: var(--accent); color: var(--accent); }
</style>
</head>
<body>
<div class="header">
  <div class="header-left"><h1>🔖 Startmark</h1><span>v0.1</span></div>
  <div class="search-box">
    <span style="opacity:.4">🔍</span>
    <input type="text" placeholder="搜索书签..." value=""/>
    <span class="kbd">⌘F</span>
  </div>
  <div class="header-right">
    <span class="count">23 个书签</span>
    <button class="mode-btn">导航模式</button>
    <button class="mode-btn active">列表模式</button>
    <button title="深色模式" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);font-size:14px;cursor:pointer">🌙</button>
  </div>
</div>
<div class="main-layout">
  <div class="folder-panel">
    <div class="folder-tree">
      <div class="folder-item active"><span class="icon">📂</span> 书签栏 <span class="badge">23</span><span class="arrow">▶</span></div>
      <div class="folder-item" style="padding-left:24px"><span class="icon">📁</span> 工作 <span class="badge">6</span></div>
      <div class="folder-item active" style="padding-left:24px"><span class="icon">📁</span> 学习 <span class="badge">4</span></div>
      <div class="folder-item" style="padding-left:24px"><span class="icon">📁</span> 生活 <span class="badge">4</span></div>
      <div class="folder-item" style="padding-left:24px"><span class="icon">📁</span> 阅读 <span class="badge">5</span></div>
      <div class="folder-item"><span class="icon">📂</span> 其他书签 <span class="badge">4</span></div>
    </div>
    <div class="btn-new">+ 新建文件夹</div>
  </div>
  <div class="bookmark-panel">
    <div class="toolbar">
      <span class="title">📖 学习</span>
      <span class="info">4 个书签</span>
      <span class="info">· 0 已选</span>
      <div class="actions">
        <button>全选</button>
        <button class="delete" style="color:#e74c3c">🗑️ 删除</button>
      </div>
    </div>
    <div class="bookmark-list">
      <div class="list-item">
        <input type="checkbox">
        <img src="https://www.google.com/s2/favicons?domain=developer.mozilla.org&sz=32" alt="">
        <span class="title">MDN Web Docs</span>
        <span class="domain">developer.mozilla.org</span>
        <span class="time">1 月前</span>
      </div>
      <div class="list-item">
        <input type="checkbox">
        <img src="https://www.google.com/s2/favicons?domain=react.dev&sz=32" alt="">
        <span class="title">React Documentation</span>
        <span class="domain">react.dev</span>
        <span class="time">2 月前</span>
      </div>
      <div class="list-item">
        <input type="checkbox">
        <img src="https://www.google.com/s2/favicons?domain=typescriptlang.org&sz=32" alt="">
        <span class="title">TypeScript Handbook</span>
        <span class="domain">typescriptlang.org</span>
        <span class="time">3 月前</span>
      </div>
      <div class="list-item">
        <input type="checkbox">
        <img src="https://www.google.com/s2/favicons?domain=wxt.dev&sz=32" alt="">
        <span class="title">WXT Framework Docs</span>
        <span class="domain">wxt.dev</span>
        <span class="time">3 月前</span>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

function buildDarkPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Startmark - Dark Mode</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --bg: #1a1a2e;
  --surface: #232346;
  --text: #e8e8f0;
  --text-secondary: #9a9ab0;
  --text-muted: #6a6a80;
  --border: #2a2a4a;
  --accent: #6b9fff;
  --sidebar-bg: #1e1e38;
  --sidebar-hover: #2a2a4a;
  --sidebar-active: #2e2e55;
  --shadow: 0 1px 4px rgba(0,0,0,0.2);
}
body {
  font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background: var(--bg);
  color: var(--text);
  overflow: hidden; height: 100vh;
}
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px; background: var(--surface);
  border-bottom: 1px solid var(--border); height: 52px;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-left h1 { font-size: 16px; font-weight: 600; color: var(--accent); }
.header-left span { font-size: 12px; color: var(--text-muted); }
.search-box { display: flex; align-items: center; gap: 6px; background: var(--bg); border-radius: 8px; padding: 6px 12px; width: 240px; }
.search-box input { border: none; background: none; outline: none; font-size: 13px; width: 100%; color: var(--text); }
.search-box .kbd { font-size: 10px; color: var(--text-muted); background: var(--surface); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border); }
.header-right { display: flex; align-items: center; gap: 10px; }
.header-right .count { font-size: 12px; color: var(--text-muted); }
.mode-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); font-size: 12px; cursor: pointer; color: var(--text); }
.mode-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.main-layout { display: flex; height: calc(100vh - 52px); }
.folder-panel { width: 220px; background: var(--sidebar-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
.folder-tree { flex: 1; overflow-y: auto; padding: 8px; }
.folder-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.folder-item:hover { background: var(--sidebar-hover); }
.folder-item.active { background: var(--sidebar-active); color: var(--accent); font-weight: 500; }
.folder-item .icon { font-size: 14px; }
.folder-item .badge { margin-left: auto; font-size: 11px; color: var(--text-muted); background: var(--bg); padding: 0 6px; border-radius: 4px; }
.grid-layout { flex: 1; overflow-y: auto; display: flex; gap: 24px; padding: 24px; }
.grid-column { min-width: 200px; max-width: 260px; flex-shrink: 0; }
.grid-column h3 { font-size: 13px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 6px; color: var(--text); }
.grid-column h3 .count { font-weight: 400; font-size: 11px; color: var(--text-muted); }
.grid-cards { display: flex; flex-direction: column; gap: 6px; }
.grid-card { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--surface); border-radius: 8px; box-shadow: var(--shadow); border: 1px solid var(--border); cursor: pointer; transition: all .1s; }
.grid-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.2); transform: translateY(-1px); }
.grid-card img { width: 16px; height: 16px; border-radius: 2px; flex-shrink: 0; }
.grid-card .title { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.btn-new { margin: 8px; padding: 6px; border-radius: 6px; border: 1px dashed var(--border); background: none; font-size: 12px; color: var(--text-muted); cursor: pointer; text-align: center; }
.btn-new:hover { border-color: var(--accent); color: var(--accent); }
</style>
</head>
<body>
<div class="header">
  <div class="header-left"><h1>🔖 Startmark</h1><span>v0.1</span></div>
  <div class="search-box">
    <span style="opacity:.4">🔍</span>
    <input type="text" placeholder="搜索书签..." value=""/>
    <span class="kbd">⌘F</span>
  </div>
  <div class="header-right">
    <span class="count">23 个书签</span>
    <button class="mode-btn active">导航模式</button>
    <button class="mode-btn">列表模式</button>
    <button title="浅色模式" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);font-size:14px;cursor:pointer">☀️</button>
  </div>
</div>
<div class="main-layout">
  <div class="folder-panel">
    <div class="folder-tree">
      <div class="folder-item active"><span class="icon">📂</span> 书签栏 <span class="badge">19</span></div>
      <div class="folder-item"><span class="icon">📁</span> 其他书签 <span class="badge">4</span></div>
    </div>
    <div class="btn-new">+ 新建文件夹</div>
  </div>
  <div class="grid-layout">
    <div class="grid-column">
      <h3>📂 工作 <span class="count">· 6</span></h3>
      <div class="grid-cards">
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=notion.so&sz=32" alt=""><span class="title">Notion</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=figma.com&sz=32" alt=""><span class="title">Figma</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=linear.app&sz=32" alt=""><span class="title">Linear</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=slack.com&sz=32" alt=""><span class="title">Slack</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=github.com&sz=32" alt=""><span class="title">GitHub</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=vercel.com&sz=32" alt=""><span class="title">Vercel</span></div>
      </div>
    </div>
    <div class="grid-column">
      <h3>📖 学习 <span class="count">· 4</span></h3>
      <div class="grid-cards">
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=developer.mozilla.org&sz=32" alt=""><span class="title">MDN Web Docs</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=react.dev&sz=32" alt=""><span class="title">React Documentation</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=typescriptlang.org&sz=32" alt=""><span class="title">TypeScript Handbook</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=wxt.dev&sz=32" alt=""><span class="title">WXT Framework Docs</span></div>
      </div>
    </div>
    <div class="grid-column">
      <h3>🎮 生活 <span class="count">· 4</span></h3>
      <div class="grid-cards">
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=youtube.com&sz=32" alt=""><span class="title">YouTube</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=music.apple.com&sz=32" alt=""><span class="title">Apple Music</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=x.com&sz=32" alt=""><span class="title">X (Twitter)</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=github.com&sz=32" alt=""><span class="title">GitHub Trending</span></div>
      </div>
    </div>
    <div class="grid-column">
      <h3>📰 阅读 <span class="count">· 5</span></h3>
      <div class="grid-cards">
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=news.ycombinator.com&sz=32" alt=""><span class="title">Hacker News</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=alistapart.com&sz=32" alt=""><span class="title">A List Apart</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=smashingmagazine.com&sz=32" alt=""><span class="title">Smashing Magazine</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=css-tricks.com&sz=32" alt=""><span class="title">CSS-Tricks</span></div>
        <div class="grid-card"><img src="https://www.google.com/s2/favicons?domain=dev.to&sz=32" alt=""><span class="title">Dev.to</span></div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

function buildSearchPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Startmark - Search</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --bg: #f5f7fa;
  --surface: #fff;
  --text: #1a1a2e;
  --text-secondary: #666;
  --text-muted: #999;
  --border: #e8ecf0;
  --accent: #4a90d9;
  --sidebar-bg: #fff;
  --sidebar-hover: #f0f4f9;
  --sidebar-active: #e3edf7;
  --shadow: 0 1px 4px rgba(0,0,0,0.04);
}
body {
  font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background: var(--surface);
  color: var(--text);
  overflow: hidden; height: 100vh;
}
.header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px; background: var(--surface);
  border-bottom: 1px solid var(--border); height: 52px;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-left h1 { font-size: 16px; font-weight: 600; color: var(--accent); }
.header-left span { font-size: 12px; color: var(--text-muted); }
.search-box { display: flex; align-items: center; gap: 6px; background: var(--bg); border-radius: 8px; padding: 6px 12px; width: 240px; border: 2px solid var(--accent); }
.search-box input { border: none; background: none; outline: none; font-size: 13px; width: 100%; color: var(--text); }
.search-box .kbd { font-size: 10px; color: var(--text-muted); background: var(--surface); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border); }
.header-right { display: flex; align-items: center; gap: 10px; }
.header-right .count { font-size: 12px; color: var(--text-muted); }
.mode-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); font-size: 12px; cursor: pointer; color: var(--text); }
.mode-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.search-results { padding: 40px; max-width: 700px; margin: 0 auto; }
.search-results h2 { font-size: 15px; font-weight: 600; margin-bottom: 20px; }
.highlight { background: #fff3b0; padding: 0 2px; border-radius: 2px; }
.sr-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; cursor: pointer; }
.sr-item:hover { background: var(--bg); }
.sr-item img { width: 16px; height: 16px; }
.sr-item .info { flex: 1; }
.sr-item .info .title { font-size: 13px; }
.sr-item .info .url { font-size: 11px; color: var(--text-muted); }
.sr-item .folder-tag { font-size: 11px; background: var(--bg); padding: 2px 8px; border-radius: 4px; color: var(--text-muted); }
</style>
</head>
<body>
<div class="header">
  <div class="header-left"><h1>🔖 Startmark</h1><span>v0.1</span></div>
  <div class="search-box">
    <span style="opacity:.4">🔍</span>
    <input type="text" placeholder="搜索书签..." value="React"/>
    <span class="kbd">⌘F</span>
  </div>
  <div class="header-right">
    <span class="count">23 个书签</span>
    <button class="mode-btn active">导航模式</button>
    <button class="mode-btn">列表模式</button>
    <button title="深色模式" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);font-size:14px;cursor:pointer">🌙</button>
  </div>
</div>
<div style="background:#f5f7fa;height:calc(100vh - 52px);display:flex;align-items:flex-start;justify-content:center;">
<div class="search-results">
  <h2>🔍 找到 2 个匹配 "React" 的书签</h2>
  <div class="sr-item">
    <img src="https://www.google.com/s2/favicons?domain=react.dev&sz=32" alt="">
    <div class="info">
      <div class="title"><span class="highlight">React</span> Documentation</div>
      <div class="url">react.dev</div>
    </div>
    <span class="folder-tag">📖 学习</span>
  </div>
  <div class="sr-item">
    <img src="https://www.google.com/s2/favicons?domain=wxt.dev&sz=32" alt="">
    <div class="info">
      <div class="title">WXT Framework Docs <span style="color:var(--text-muted);font-size:11px">(built with <span class="highlight">React</span>)</span></div>
      <div class="url">wxt.dev</div>
    </div>
    <span class="folder-tag">📖 学习</span>
  </div>
</div>
</div>
</body>
</html>`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log("Output dir:", OUT_DIR);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--no-first-run"],
  });

  const pages = [];
  const configs = [
    { name: "screenshot-1-grid.png", html: buildGridPage() },
    { name: "screenshot-2-list.png", html: buildListPage() },
    { name: "screenshot-3-dark.png", html: buildDarkPage() },
    { name: "screenshot-4-search.png", html: buildSearchPage() },
  ];

  for (const cfg of configs) {
    console.log(`\n📸 Taking ${cfg.name}...`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Write temp HTML to a file and load it (avoids URL length issues)
    const tmpFile = path.join(OUT_DIR, `__tmp_${cfg.name}.html`);
    fs.writeFileSync(tmpFile, cfg.html);
    await page.goto(`file://${tmpFile}`, { waitUntil: "networkidle0", timeout: 15000 });

    // Wait for favicon images to load
    await sleep(2000);

    await page.screenshot({ path: path.join(OUT_DIR, cfg.name) });
    console.log(`  -> ${cfg.name} saved`);

    // Clean up temp file
    fs.unlinkSync(tmpFile);
    await page.close();
  }

  await browser.close();

  console.log("\n✅ All 4 screenshots generated!");
  for (const f of fs.readdirSync(OUT_DIR).filter(f => f.startsWith("screenshot-"))) {
    const stat = fs.statSync(path.join(OUT_DIR, f));
    console.log(`  ${f}  (${Math.round(stat.size / 1024)} KB)`);
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
