import React from "react";

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  bookmarkCount: number;
}

export default function Header({ searchQuery, onSearchChange, bookmarkCount }: Props) {
  return (
    <header className="header">
      <h1 className="header-title">🔖 Bookmark Cleaner</h1>
      <span className="header-count">共 {bookmarkCount} 个书签</span>
      <div className="header-search">
        <input
          type="text"
          placeholder="搜索书签..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
      </div>
    </header>
  );
}
