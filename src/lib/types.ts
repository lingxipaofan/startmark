export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  parentId?: string;
  index?: number;
  dateAdded?: number;
  children?: BookmarkNode[];
}

export type LinkStatus = "unknown" | "valid" | "broken" | "checking";

export interface ContextMenuState {
  x: number;
  y: number;
  kind: "bookmark" | "folder" | "background";
  node?: BookmarkNode;
}

export interface SavedTreeNode {
  parentId?: string;
  title: string;
  url?: string;
  index?: number;
  children?: SavedTreeNode[];
}
