export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  parentId?: string;
  dateAdded?: number;
  children?: BookmarkNode[];
}

export interface ContextMenuState {
  x: number;
  y: number;
  type: "folder" | "bookmark";
  node: BookmarkNode;
}
