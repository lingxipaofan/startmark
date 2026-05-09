import React from "react";

interface Props {
  folderTitle: string;
  bookmarkCount: number;
  selectedCount: number;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onDeleteSelected: () => void;
  emptyFolders: { id: string; title: string }[];
  duplicateBookmarks: { id: string; title: string; url: string }[];
}

export default function ToolBar({
  folderTitle,
  bookmarkCount,
  selectedCount,
  allSelected,
  onToggleSelectAll,
  onDeleteSelected,
  emptyFolders,
  duplicateBookmarks,
}: Props) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <strong>{folderTitle}</strong>
        <span className="toolbar-count">({bookmarkCount} 个书签)</span>
      </div>
      <div className="toolbar-center">
        {bookmarkCount > 0 && (
          <label className="select-all-label">
            <input
              type="checkbox"
              checked={allSelected && bookmarkCount > 0}
              onChange={onToggleSelectAll}
            />
            全选
          </label>
        )}
        {selectedCount > 0 && (
          <button className="btn-delete" onClick={onDeleteSelected}>
            🗑 删除选中 ({selectedCount})
          </button>
        )}
      </div>
      <div className="toolbar-right">
        {emptyFolders.length > 0 && (
          <span className="cleanup-hint" title={`${emptyFolders.length} 个空文件夹`}>
            📂 空文件夹: {emptyFolders.length}
          </span>
        )}
        {duplicateBookmarks.length > 0 && (
          <span className="cleanup-hint" title="点击查看重复书签">
            🔁 重复: {duplicateBookmarks.length}
          </span>
        )}
      </div>
    </div>
  );
}
