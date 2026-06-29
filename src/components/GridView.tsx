import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { ArrowLeft, Clock3, Eye, EyeOff, Folder } from "lucide-react";
import type { BookmarkNode, LinkStatus } from "../lib/types";
import { useI18n, timeBucket } from "../lib/i18n";
import {
  sortBookmarkNodes,
  type AlphabeticalDirection,
  type SortMode,
} from "../lib/bookmark-sort";
import { simplifyBookmarkTitle } from "../lib/bookmark-title";
import {
  getRelativeMoveDestination,
  moveIdRelative,
  moveIdToEnd,
  orderByIds,
  type DragOrderState,
  type DropPosition,
} from "../lib/custom-order";

interface Props {
  tree: BookmarkNode[];
  searchQuery: string;
  onMove: (id: string, destinationFolderId: string, index?: number) => void | Promise<void>;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
  onBackgroundContextMenu: (e: React.MouseEvent) => void;
  onToggleFolderHidden: (folder: BookmarkNode) => void;
  onDetailActiveChange?: (active: boolean) => void;
  getLinkStatus?: (id: string) => LinkStatus;
  sortMode: SortMode;
  alphabeticalDirection: AlphabeticalDirection;
  simplifyTitles: boolean;
  hiddenFolderIds: Set<string>;
  showHiddenFolders: boolean;
  uiScale: number;
}

interface FolderSection {
  folder: BookmarkNode;
  bookmarks: BookmarkNode[];
  breadcrumb: string[]; // ancestor titles, e.g. ["涔︾鏍?, "宸ヤ綔"]
}

type DragItem = {
  node: BookmarkNode;
  type: "bookmark" | "folder";
};

type DropTarget =
  | { kind: "bookmark" | "folder"; id: string; position: DropPosition }
  | { kind: "inside"; id: string };

type PendingDragPreview = {
  key: string;
  x: number;
  y: number;
  target: DropTarget;
  apply: () => void;
};

type DragLayoutSnapshot = {
  bookmarks: Array<{ id: string; rect: DOMRect }>;
  folders: Array<{ id: string; rect: DOMRect; height: number; hasBookmarks: boolean }>;
};

const DRAG_PREVIEW_UNLOCK_DISTANCE = 4;
const FOLDER_DRAG_PREVIEW_UNLOCK_DISTANCE = 18;
const DEFAULT_FOLDER_PREVIEW_LIMIT = 4;
const FOLDER_PREVIEW_STEP = 4;
const MIN_FOLDER_PREVIEW_LIMIT = 4;
const MAX_FOLDER_PREVIEW_LIMIT = 16;
const FOLDER_PREVIEW_LIMITS_KEY = "startmark-folder-preview-limits";
const FOLDER_HEIGHT_SCALE = 0.95;
const GRID_CELL_HEIGHT = 30 * FOLDER_HEIGHT_SCALE;
const GRID_CELL_GAP = 5 * FOLDER_HEIGHT_SCALE;
const GRID_SECTION_PADDING = 8 * FOLDER_HEIGHT_SCALE;
const GRID_SECTION_ROW_GAP = 14 * FOLDER_HEIGHT_SCALE;
const GRID_RESIZE_HANDLE_HEIGHT = 9 * FOLDER_HEIGHT_SCALE;

function clampFolderPreviewLimit(value: number): number {
  const clamped = Math.max(
    MIN_FOLDER_PREVIEW_LIMIT,
    Math.min(MAX_FOLDER_PREVIEW_LIMIT, Math.round(value))
  );
  return Math.max(
    MIN_FOLDER_PREVIEW_LIMIT,
    Math.min(MAX_FOLDER_PREVIEW_LIMIT, Math.round(clamped / FOLDER_PREVIEW_STEP) * FOLDER_PREVIEW_STEP)
  );
}

function readFolderPreviewLimits(): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(FOLDER_PREVIEW_LIMITS_KEY) || "{}") as Record<string, number>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, value]) => Number.isFinite(value))
        .map(([id, value]) => [id, clampFolderPreviewLimit(value)])
    );
  } catch {
    return {};
  }
}

function getFolderSizeLevel(previewLimit: number): number {
  return Math.max(1, previewLimit / FOLDER_PREVIEW_STEP);
}

function getFolderBaseHeight(scale: number): number {
  const bodyHeight =
    DEFAULT_FOLDER_PREVIEW_LIMIT * GRID_CELL_HEIGHT +
    (DEFAULT_FOLDER_PREVIEW_LIMIT - 1) * GRID_CELL_GAP;
  return (
    GRID_SECTION_PADDING * 2 +
    GRID_CELL_HEIGHT +
    bodyHeight +
    GRID_RESIZE_HANDLE_HEIGHT +
    GRID_CELL_GAP * 2
  ) * scale;
}

function getFolderSnappedHeight(previewLimit: number, scale: number): number {
  const level = getFolderSizeLevel(previewLimit);
  return getFolderBaseHeight(scale) * level + GRID_SECTION_ROW_GAP * scale * (level - 1);
}

function getFolderRenderLimit(previewLimit: number, scale: number): number {
  const availableBodyHeight =
    getFolderSnappedHeight(previewLimit, scale) / scale -
    GRID_SECTION_PADDING * 2 -
    GRID_CELL_HEIGHT -
    GRID_RESIZE_HANDLE_HEIGHT -
    GRID_CELL_GAP * 2;
  return Math.max(
    MIN_FOLDER_PREVIEW_LIMIT,
    Math.floor((availableBodyHeight + GRID_CELL_GAP) / (GRID_CELL_HEIGHT + GRID_CELL_GAP))
  );
}

function findNode(nodes: BookmarkNode[], id: string): BookmarkNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export default function GridView({
  tree,
  searchQuery,
  onMove,
  onContextMenu,
  onBackgroundContextMenu,
  onToggleFolderHidden,
  onDetailActiveChange,
  getLinkStatus,
  sortMode,
  alphabeticalDirection,
  simplifyTitles,
  hiddenFolderIds,
  showHiddenFolders,
  uiScale,
}: Props) {
  const { t } = useI18n();
  const [dragPreviewOrder, setDragPreviewOrder] = useState<DragOrderState | null>(null);
  const [crossFolderPreview, setCrossFolderPreview] = useState<{
    bookmark: BookmarkNode;
    targetFolderId: string;
  } | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeTimeGroupLabel, setActiveTimeGroupLabel] = useState<string | null>(null);
  const [isClosingDetail, setIsClosingDetail] = useState(false);
  const [folderPreviewLimits, setFolderPreviewLimits] = useState<Record<string, number>>(readFolderPreviewLimits);
  const [resizingPreview, setResizingPreview] = useState<{ folderId: string; limit: number } | null>(null);
  const [masonryColumnCount, setMasonryColumnCount] = useState<number>();
  const [masonryWidth, setMasonryWidth] = useState<number>();
  const [detailViewportTop, setDetailViewportTop] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragData = useRef<DragItem | null>(null);
  const dragOriginRect = useRef<DOMRect | null>(null);
  const dragLayoutSnapshot = useRef<DragLayoutSnapshot | null>(null);
  const dragBaseOrder = useRef<DragOrderState | null>(null);
  const committedDragPreview = useRef<{ key: string; x: number; y: number } | null>(null);
  const committedDropTarget = useRef<DropTarget | null>(null);
  const layoutRectsBeforePreview = useRef<Map<string, DOMRect> | null>(null);
  const stableLayoutRects = useRef<Map<string, DOMRect> | null>(null);
  const previousShowHiddenFolders = useRef(showHiddenFolders);
  const previousVisibleSectionSignature = useRef("");
  const layoutAnimations = useRef<Map<string, Animation>>(new Map());
  const documentDragOverHandler = useRef<(event: DragEvent) => void>(() => undefined);
  const documentDropHandler = useRef<(event: DragEvent) => void>(() => undefined);
  const resizingPreviewRef = useRef<{ folderId: string; limit: number } | null>(null);
  const [draggingItem, setDraggingItem] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  useEffect(() => {
    resizingPreviewRef.current = resizingPreview;
  }, [resizingPreview]);

  useEffect(() => {
    try {
      localStorage.setItem(FOLDER_PREVIEW_LIMITS_KEY, JSON.stringify(folderPreviewLimits));
    } catch { /* ignore */ }
  }, [folderPreviewLimits]);

  const getFolderPreviewLimit = useCallback(
    (folderId: string) => folderPreviewLimits[folderId] || DEFAULT_FOLDER_PREVIEW_LIMIT,
    [folderPreviewLimits]
  );

  const sections = useMemo(() => {
    const result: FolderSection[] = [];
    const walk = (nodes: BookmarkNode[], ancestors: BookmarkNode[] = []) => {
      for (const node of nodes) {
        if (!node.children) continue;
        const directBms = node.children.filter((c) => !!c.url);
        const isBrowserRoot = node.id === "0";
        if (!isBrowserRoot) {
          result.push({
            folder: node,
            bookmarks: directBms,
            breadcrumb: ancestors
              .filter((ancestor) => ancestor.id !== "0" && ancestor.parentId !== "0")
              .map((ancestor) => ancestor.title),
          });
        }
        walk(node.children, [...ancestors, node]);
      }
    };
    walk(tree);
    return result;
  }, [tree]);

  useEffect(() => {
    if (!draggingItem) return;
    const lockDocumentDragCursor = (event: DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    };
    const handleDocumentDragOver = (event: DragEvent) => {
      lockDocumentDragCursor(event);
      documentDragOverHandler.current(event);
    };
    const handleDocumentDragEnter = (event: DragEvent) => {
      lockDocumentDragCursor(event);
    };
    const handleDocumentDrop = (event: DragEvent) => documentDropHandler.current(event);
    document.body.classList.add("drag-active");
    document.documentElement.classList.add("drag-active");
    document.addEventListener("dragenter", handleDocumentDragEnter);
    document.addEventListener("dragover", handleDocumentDragOver);
    document.addEventListener("drop", handleDocumentDrop);
    return () => {
      document.body.classList.remove("drag-active");
      document.documentElement.classList.remove("drag-active");
      document.removeEventListener("dragenter", handleDocumentDragEnter);
      document.removeEventListener("dragover", handleDocumentDragOver);
      document.removeEventListener("drop", handleDocumentDrop);
    };
  }, [draggingItem]);

  // Time-sorted 鈥?oldest first
  const timeSortedBookmarks = useMemo(() => {
    const all: BookmarkNode[] = [];
    for (const s of sections) {
      for (const b of s.bookmarks) all.push(b);
    }
    all.sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return all.filter(
        (b) => b.title.toLowerCase().includes(q) || (b.url || "").toLowerCase().includes(q)
      );
    }
    return all;
  }, [sections, searchQuery]);

  const timeGroups = useMemo(() => {
    const map = new Map<string, BookmarkNode[]>();
    for (const b of timeSortedBookmarks) {
      const bucket = timeBucket(b.dateAdded || 0, t);
      if (!map.has(bucket)) map.set(bucket, []);
      map.get(bucket)!.push(b);
    }
    return Array.from(map.entries())
      .map(([label, bookmarks]) => ({
        label,
        bookmarks,
        sortKey: Math.min(...bookmarks.map((b) => b.dateAdded || 0)),
      }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [timeSortedBookmarks, t]);

  const orderedFolderSections = useMemo(() => {
    const orderedSections = dragPreviewOrder
      ? orderByIds(sections, dragPreviewOrder.folderIds, (section) => section.folder.id)
      : sortMode === "alphabetical"
      ? sortBookmarkNodes(
          sections.map((section) => section.folder),
          sortMode,
          alphabeticalDirection
        ).map((folder) => sections.find((section) => section.folder.id === folder.id)!)
      : sections;

    return orderedSections.map((section) => {
      const sectionBookmarks = crossFolderPreview?.targetFolderId === section.folder.id
        ? [
            ...section.bookmarks,
            { ...crossFolderPreview.bookmark, parentId: section.folder.id },
          ]
        : section.bookmarks;
      return {
        ...section,
        breadcrumbLabel: section.breadcrumb.slice(-2).join(" / "),
        bookmarks: dragPreviewOrder
        ? orderByIds(
            sectionBookmarks,
            dragPreviewOrder.bookmarkIdsByFolder[section.folder.id] || [],
            (bookmark) => bookmark.id
          )
        : sortBookmarkNodes(sectionBookmarks, sortMode, alphabeticalDirection),
      };
    });
  }, [
    sections,
    sortMode,
    alphabeticalDirection,
    dragPreviewOrder,
    crossFolderPreview,
  ]);

  const displayedFolderSections = useMemo(() => {
    const visibleSections = showHiddenFolders
      ? orderedFolderSections
      : orderedFolderSections.filter((section) => !hiddenFolderIds.has(section.folder.id));
    if (!searchQuery) return visibleSections;
    const query = searchQuery.toLowerCase();
    return visibleSections
      .map((section) => ({
        ...section,
        bookmarks: section.bookmarks.filter(
          (bookmark) =>
            bookmark.title.toLowerCase().includes(query) ||
            (bookmark.url || "").toLowerCase().includes(query)
        ),
      }))
      .filter((section) => section.bookmarks.length > 0);
  }, [hiddenFolderIds, orderedFolderSections, searchQuery, showHiddenFolders]);

  const visibleSectionSignature = useMemo(
    () => displayedFolderSections.map((section) => section.folder.id).join("|"),
    [displayedFolderSections]
  );

  const buildMasonryColumns = <T,>(
    items: T[],
    columnCount: number,
    getWeight: (item: T) => number
  ) => {
    const safeColumnCount = Math.max(1, columnCount);
    const columns = Array.from({ length: safeColumnCount }, () => [] as T[]);
    const columnWeights = Array.from({ length: safeColumnCount }, () => 0);

    items.forEach((item) => {
      const targetColumnIndex = columnWeights.reduce(
        (bestIndex, weight, index) => weight < columnWeights[bestIndex] ? index : bestIndex,
        0
      );
      columns[targetColumnIndex].push(item);
      columnWeights[targetColumnIndex] += getWeight(item);
    });

    return columns;
  };

  const activeMasonryColumnCount = masonryColumnCount || 1;

  const folderMasonryColumns = useMemo(
    () => buildMasonryColumns(
      displayedFolderSections,
      activeMasonryColumnCount,
      (section) => getFolderSizeLevel(getFolderPreviewLimit(section.folder.id))
    ),
    [displayedFolderSections, activeMasonryColumnCount, getFolderPreviewLimit]
  );

  const timeMasonryColumns = useMemo(
    () => buildMasonryColumns(
      timeGroups,
      activeMasonryColumnCount,
      () => 1
    ),
    [timeGroups, activeMasonryColumnCount]
  );

  const handleCardClick = (bm: BookmarkNode) => {
    if (bm.url) chrome.tabs.update({ url: bm.url });
  };

  const closeActiveDetail = useCallback(() => {
    if (isClosingDetail) return;
    setIsClosingDetail(true);
    onDetailActiveChange?.(false);
    window.setTimeout(() => {
      setActiveFolderId(null);
      setActiveTimeGroupLabel(null);
      setIsClosingDetail(false);
    }, 160);
  }, [isClosingDetail, onDetailActiveChange]);

  const getDragLayoutSnapshot = (): DragLayoutSnapshot | null => {
    const root = getDragLayoutRoot();
    if (!root) return null;
    return {
      bookmarks: Array.from(
        root.querySelectorAll<HTMLElement>("[data-bookmark-id]:not(.drag-preview-card)")
      )
      .filter((element) => !element.closest(".grid-section-collapse.collapsed"))
      .map((element) => ({
        id: element.dataset.bookmarkId!,
        rect: element.getBoundingClientRect(),
      })),
      folders: Array.from(
        root.querySelectorAll<HTMLElement>(".grid-section[data-folder-id]")
      ).map((element) => ({
        id: element.dataset.folderId!,
        rect: element.getBoundingClientRect(),
        height: element.getBoundingClientRect().height,
        hasBookmarks:
          !element.querySelector(".grid-section-collapse.collapsed") &&
          !!element.querySelector("[data-bookmark-id]:not(.drag-preview-card)"),
      })),
    };
  };

  const getDragLayoutRoot = (): HTMLElement | null => {
    const grid = gridRef.current;
    if (!grid) return null;
    if (!activeDetail) return grid;
    return grid.querySelector<HTMLElement>(".folder-detail-view") || grid;
  };

  const handleFolderResizeStart = (
    e: React.PointerEvent<HTMLDivElement>,
    folderId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startLimit = getFolderPreviewLimit(folderId);
    const initialPreview = { folderId, limit: startLimit };
    const sizeStep = Math.max(
      1,
      getFolderBaseHeight(uiScale) + GRID_SECTION_ROW_GAP * uiScale
    );
    resizingPreviewRef.current = initialPreview;
    setResizingPreview(initialPreview);
    document.body.classList.add("resize-active");
    document.documentElement.classList.add("resize-active");

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      const nextLimit = clampFolderPreviewLimit(
        startLimit + Math.round((event.clientY - startY) / sizeStep) * FOLDER_PREVIEW_STEP
      );
      setResizingPreview((prev) =>
        prev?.folderId === folderId && prev.limit === nextLimit
          ? prev
          : { folderId, limit: nextLimit }
      );
    };

    const clearResize = () => {
      const latestLimit = resizingPreviewRef.current?.folderId === folderId
        ? resizingPreviewRef.current.limit
        : startLimit;
      if ((folderPreviewLimits[folderId] || DEFAULT_FOLDER_PREVIEW_LIMIT) !== latestLimit) {
        captureLayoutRects();
      }
      setFolderPreviewLimits((prev) => {
        if ((prev[folderId] || DEFAULT_FOLDER_PREVIEW_LIMIT) === latestLimit) return prev;
        return { ...prev, [folderId]: latestLimit };
      });
      setResizingPreview(null);
      document.body.classList.remove("resize-active");
      document.documentElement.classList.remove("resize-active");
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", clearResize);
      document.removeEventListener("pointercancel", clearResize);
    };

    document.addEventListener("pointermove", handlePointerMove, { passive: false });
    document.addEventListener("pointerup", clearResize);
    document.addEventListener("pointercancel", clearResize);
  };

  const handleDragStart = (
    e: React.DragEvent,
    node: BookmarkNode,
    type: DragItem["type"]
  ) => {
    dragData.current = { node, type };
    dragBaseOrder.current = createDragOrderSnapshot();
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ id: node.id, type }));
    const source = e.currentTarget as HTMLElement;
    const rect = source.getBoundingClientRect();
    dragOriginRect.current = rect;
    dragLayoutSnapshot.current = getDragLayoutSnapshot();
    setDraggingItem({ node, type });
    const dragImage = source.cloneNode(true) as HTMLElement;
    dragImage.classList.add("drag-floating-image");
    dragImage.style.width = `${rect.width}px`;
    dragImage.style.height = `${rect.height}px`;
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(
      dragImage,
      Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
      Math.max(0, Math.min(rect.height, e.clientY - rect.top))
    );
    requestAnimationFrame(() => dragImage.remove());
  };

  const readDragItem = (e: React.DragEvent): DragItem | null => {
    if (dragData.current) return dragData.current;
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { id?: string; type?: DragItem["type"] } | string[];
      const id = Array.isArray(parsed) ? parsed[0] : parsed.id;
      if (!id) return null;
      const node = findNode(tree, id);
      if (!node) return null;
      return { node, type: !Array.isArray(parsed) && parsed.type ? parsed.type : node.url ? "bookmark" : "folder" };
    } catch {
      const node = findNode(tree, raw);
      return node ? { node, type: node.url ? "bookmark" : "folder" } : null;
    }
  };

  const clearDragState = () => {
    dragData.current = null;
    dragOriginRect.current = null;
    dragLayoutSnapshot.current = null;
    dragBaseOrder.current = null;
    committedDragPreview.current = null;
    committedDropTarget.current = null;
    layoutRectsBeforePreview.current = null;
    setDraggingItem(null);
    setDropTarget(null);
    setDragPreviewOrder(null);
    setCrossFolderPreview(null);
  };

  const cloneDragOrder = (order: DragOrderState): DragOrderState => ({
    folderIds: [...order.folderIds],
    bookmarkIdsByFolder: Object.fromEntries(
      Object.entries(order.bookmarkIdsByFolder).map(([folderId, ids]) => [folderId, [...ids]])
    ),
  });

  const captureLayoutRects = () => {
    const rects = new Map<string, DOMRect>();
    getDragLayoutRoot()?.querySelectorAll<HTMLElement>("[data-drag-layout-id]").forEach((element) => {
      const id = element.dataset.dragLayoutId;
      if (id) rects.set(id, element.getBoundingClientRect());
    });
    layoutRectsBeforePreview.current = rects;
  };

  const queueDragPreview = (candidate: PendingDragPreview) => {
    const committed = committedDragPreview.current;
    if (committed?.key === candidate.key) return;
    const unlockDistance = dragData.current?.type === "folder"
      ? FOLDER_DRAG_PREVIEW_UNLOCK_DISTANCE
      : DRAG_PREVIEW_UNLOCK_DISTANCE;
    if (
      committed &&
      Math.hypot(candidate.x - committed.x, candidate.y - committed.y) < unlockDistance
    ) return;

    captureLayoutRects();
    committedDragPreview.current = { key: candidate.key, x: candidate.x, y: candidate.y };
    committedDropTarget.current = candidate.target;
    setDropTarget(candidate.target);
    candidate.apply();
  };

  useLayoutEffect(() => {
    const previousRects = layoutRectsBeforePreview.current;
    if (!previousRects) return;
    layoutRectsBeforePreview.current = null;
    getDragLayoutRoot()?.querySelectorAll<HTMLElement>("[data-drag-layout-id]").forEach((element) => {
      const id = element.dataset.dragLayoutId;
      const previous = id ? previousRects.get(id) : undefined;
      if (!previous) return;
      const current = element.getBoundingClientRect();
      const deltaX = previous.left - current.left;
      const deltaY = previous.top - current.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;
      layoutAnimations.current.get(id!)?.cancel();
      const animation = element.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" },
        ],
        { duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
      );
      layoutAnimations.current.set(id!, animation);
      animation.finished
        .then(() => {
          if (layoutAnimations.current.get(id!) === animation) {
            layoutAnimations.current.delete(id!);
          }
        })
        .catch(() => undefined);
    });
  }, [crossFolderPreview, dragPreviewOrder, folderPreviewLimits]);

  useLayoutEffect(() => {
    if (draggingItem) return;
    const elements = Array.from(
      gridRef.current?.querySelectorAll<HTMLElement>("[data-drag-layout-id]") || []
    );
    const currentRects = new Map<string, DOMRect>();
    elements.forEach((element) => {
      const id = element.dataset.dragLayoutId;
      if (id) currentRects.set(id, element.getBoundingClientRect());
    });

    const previousRects = stableLayoutRects.current;
    const shouldAnimateHiddenToggle =
      previousShowHiddenFolders.current !== showHiddenFolders ||
      previousVisibleSectionSignature.current !== visibleSectionSignature;
    stableLayoutRects.current = currentRects;
    previousShowHiddenFolders.current = showHiddenFolders;
    previousVisibleSectionSignature.current = visibleSectionSignature;
    if (
      !previousRects ||
      !shouldAnimateHiddenToggle ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return;

    elements.forEach((element) => {
      const id = element.dataset.dragLayoutId;
      if (!id) return;
      const previous = previousRects.get(id);
      const current = currentRects.get(id);
      if (!current) return;
      if (!previous) return;

      const animationKey = `stable-layout:${id}`;
      layoutAnimations.current.get(animationKey)?.cancel();

      const deltaX = previous.left - current.left;
      const deltaY = previous.top - current.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;
      const animation = element.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" },
        ],
        { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
      );
      layoutAnimations.current.set(animationKey, animation);
      animation.finished
        .then(() => {
          if (layoutAnimations.current.get(animationKey) === animation) {
            layoutAnimations.current.delete(animationKey);
          }
        })
        .catch(() => undefined);
    });
  }, [displayedFolderSections, showHiddenFolders, draggingItem, visibleSectionSignature]);

  const createDragOrderSnapshot = (): DragOrderState => {
    const sourceSections = sortMode === "time"
      ? sections.map((section) => ({
          ...section,
          bookmarks: sortBookmarkNodes(section.bookmarks, "time", "asc"),
        }))
      : orderedFolderSections;

    return {
      folderIds: sourceSections.map((section) => section.folder.id),
      bookmarkIdsByFolder: Object.fromEntries(
        sourceSections.map((section) => [
          section.folder.id,
          section.bookmarks.map((bookmark) => bookmark.id),
        ])
      ),
    };
  };

  const previewRelativeMove = (
    item: DragItem,
    target: BookmarkNode,
    type: DragItem["type"],
    position: DropPosition
  ) => {
    // Moving a bookmark between parents would remove the native drag source
    // from the DOM. Keep cross-folder moves as a highlighted target preview.
    if (sortMode === "time") {
      return;
    }

    setDragPreviewOrder(() => {
      const next = cloneDragOrder(dragBaseOrder.current || createDragOrderSnapshot());
      if (type === "bookmark") {
        const folderId = target.parentId!;
        if (item.node.parentId !== folderId) {
          setCrossFolderPreview({ bookmark: item.node, targetFolderId: folderId });
        } else {
          setCrossFolderPreview(null);
        }
        next.bookmarkIdsByFolder[folderId] = moveIdRelative(
          next.bookmarkIdsByFolder[folderId] || [],
          item.node.id,
          target.id,
          position
        );
      } else {
        setCrossFolderPreview(null);
        next.folderIds = moveIdRelative(next.folderIds, item.node.id, target.id, position);
      }
      return next;
    });
  };

  const previewInsideMove = (item: DragItem, folder: BookmarkNode) => {
    if (sortMode === "time") return;
    const next = cloneDragOrder(dragBaseOrder.current || createDragOrderSnapshot());
    if (item.type === "bookmark") {
      if (item.node.parentId !== folder.id) {
        setCrossFolderPreview({ bookmark: item.node, targetFolderId: folder.id });
      } else {
        setCrossFolderPreview(null);
      }
      next.bookmarkIdsByFolder[folder.id] = moveIdToEnd(
        next.bookmarkIdsByFolder[folder.id] || [],
        item.node.id
      );
    } else {
      setCrossFolderPreview(null);
      next.folderIds = next.folderIds.filter((id) => id !== item.node.id);
    }
    setDragPreviewOrder(next);
  };

  const distanceToRect = (x: number, y: number, rect: DOMRect): number => {
    const deltaX = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
    const deltaY = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    return deltaX * deltaX + deltaY * deltaY;
  };

  const isPointInsideRect = (x: number, y: number, rect: DOMRect): boolean =>
    x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

  const getRelativeDropPosition = (
    item: DragItem,
    target: BookmarkNode,
    type: DragItem["type"],
    clientX: number,
    clientY: number,
    targetRect: DOMRect
  ): DropPosition => {
    const centerX = targetRect.left + targetRect.width / 2;
    const centerY = targetRect.top + targetRect.height / 2;
    const normalizedX = Math.abs(clientX - centerX) / Math.max(1, targetRect.width);
    const normalizedY = Math.abs(clientY - centerY) / Math.max(1, targetRect.height);
    const centralIntent = normalizedX < 0.46 && normalizedY < 0.46;

    if (centralIntent) {
      const baseOrder = dragBaseOrder.current || createDragOrderSnapshot();
      const ids = type === "folder"
        ? baseOrder.folderIds
        : target.parentId
          ? baseOrder.bookmarkIdsByFolder[target.parentId] || []
          : [];
      const draggedIndex = ids.indexOf(item.node.id);
      const targetIndex = ids.indexOf(target.id);
      if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
        return draggedIndex < targetIndex ? "after" : "before";
      }
    }

    if (normalizedX > normalizedY) {
      return clientX < centerX ? "before" : "after";
    }
    return clientY < centerY ? "before" : "after";
  };

  const getNearestFolderSlot = (
    snapshot: DragLayoutSnapshot,
    item: DragItem,
    clientX: number,
    clientY: number
  ): { node: BookmarkNode; rect: DOMRect; score: number } | null => {
    let nearestFolder: { node: BookmarkNode; rect: DOMRect; score: number } | null = null;

    for (const slot of snapshot.folders) {
      if (slot.id === item.node.id) continue;
      const node = findNode(tree, slot.id);
      if (!node?.children || node.parentId === "0") continue;
      if (item.type === "folder" && findNode(item.node.children || [], slot.id)) continue;

      const centerX = slot.rect.left + slot.rect.width / 2;
      const centerY = slot.rect.top + slot.rect.height / 2;
      const insideBonus = isPointInsideRect(clientX, clientY, slot.rect) ? -1_000_000 : 0;
      const centerDistance = (clientX - centerX) ** 2 + (clientY - centerY) ** 2;
      const outsideDistance = distanceToRect(clientX, clientY, slot.rect);
      const score = outsideDistance * 4 + centerDistance + insideBonus;

      if (!nearestFolder || score < nearestFolder.score) {
        nearestFolder = { node, rect: slot.rect, score };
      }
    }

    return nearestFolder;
  };

  const getFolderDropCandidate = (
    item: DragItem,
    snapshot: DragLayoutSnapshot,
    clientX: number,
    clientY: number
  ): PendingDragPreview | null => {
    const nearestFolder = getNearestFolderSlot(snapshot, item, clientX, clientY);
    if (!nearestFolder) return null;

    const rect = nearestFolder.rect;
    const position = getRelativeDropPosition(item, nearestFolder.node, "folder", clientX, clientY, rect);
    return {
      key: `folder:${nearestFolder.node.id}:${position}`,
      x: clientX,
      y: clientY,
      target: { kind: "folder", id: nearestFolder.node.id, position },
      apply: () => previewRelativeMove(item, nearestFolder.node, "folder", position),
    };
  };

  const getDetailBookmarkDropCandidate = (
    item: DragItem,
    snapshot: DragLayoutSnapshot,
    clientX: number,
    clientY: number
  ): PendingDragPreview | null => {
    if (!activeDetail || activeDetail.kind !== "folder" || item.type !== "bookmark") return null;
    const slots = snapshot.bookmarks
      .filter((slot) => slot.id !== item.node.id)
      .map((slot) => {
        const node = findNode(tree, slot.id);
        return node?.url ? { ...slot, node } : null;
      })
      .filter((slot): slot is { id: string; rect: DOMRect; node: BookmarkNode } => !!slot)
      .sort((a, b) => {
        const rowDelta = a.rect.top - b.rect.top;
        if (Math.abs(rowDelta) > Math.max(8, Math.min(a.rect.height, b.rect.height) * 0.5)) {
          return rowDelta;
        }
        return a.rect.left - b.rect.left;
      });
    if (slots.length === 0) return null;

    const rows: Array<{ centerY: number; slots: typeof slots }> = [];
    for (const slot of slots) {
      const centerY = slot.rect.top + slot.rect.height / 2;
      const row = rows.find(
        (candidate) => Math.abs(candidate.centerY - centerY) <= Math.max(8, slot.rect.height * 0.55)
      );
      if (row) {
        row.slots.push(slot);
        row.centerY =
          row.slots.reduce((sum, item) => sum + item.rect.top + item.rect.height / 2, 0) /
          row.slots.length;
      } else {
        rows.push({ centerY, slots: [slot] });
      }
    }
    rows.forEach((row) => row.slots.sort((a, b) => a.rect.left - b.rect.left));

    let row = rows[0];
    let rowDistance = Math.abs(clientY - row.centerY);
    for (const candidate of rows.slice(1)) {
      const distance = Math.abs(clientY - candidate.centerY);
      if (distance < rowDistance) {
        row = candidate;
        rowDistance = distance;
      }
    }

    const first = row.slots[0];
    const last = row.slots[row.slots.length - 1];
    let target = last;
    let position: DropPosition = "after";
    for (const slot of row.slots) {
      const centerX = slot.rect.left + slot.rect.width / 2;
      if (clientX < centerX) {
        target = slot;
        position = "before";
        break;
      }
    }
    if (clientY < rows[0].centerY - first.rect.height * 0.7) {
      target = rows[0].slots[0];
      position = "before";
    } else if (clientY > rows[rows.length - 1].centerY + last.rect.height * 0.7) {
      const finalRow = rows[rows.length - 1];
      target = finalRow.slots[finalRow.slots.length - 1];
      position = "after";
    }

    return {
      key: `detail-bookmark:${target.node.id}:${position}`,
      x: clientX,
      y: clientY,
      target: { kind: "bookmark", id: target.node.id, position },
      apply: () => previewRelativeMove(item, target.node, "bookmark", position),
    };
  };

  const updateDragPreviewAt = (clientX: number, clientY: number) => {
    const item = dragData.current;
    const grid = gridRef.current;
    const snapshot = item?.type === "folder"
      ? dragLayoutSnapshot.current
      : getDragLayoutSnapshot() || dragLayoutSnapshot.current;
    if (!item || !grid || !snapshot) return;

    const origin = dragOriginRect.current;
    if (
      !committedDropTarget.current &&
      origin &&
      clientX >= origin.left - 4 &&
      clientX <= origin.right + 4 &&
      clientY >= origin.top - 4 &&
      clientY <= origin.bottom + 4
    ) return;

    if (item.type === "bookmark") {
      if (activeDetail?.kind === "folder") {
        const candidate = getDetailBookmarkDropCandidate(item, snapshot, clientX, clientY);
        if (candidate) queueDragPreview(candidate);
        return;
      }

      let nearestBookmark: { node: BookmarkNode; rect: DOMRect; score: number } | null = null;
      for (const slot of snapshot.bookmarks) {
        if (slot.id === item.node.id) continue;
        const node = findNode(tree, slot.id);
        if (!node?.url) continue;
        const score = distanceToRect(clientX, clientY, slot.rect);
        if (!nearestBookmark || score < nearestBookmark.score) {
          nearestBookmark = { node, rect: slot.rect, score };
        }
      }

      let nearestFolder: { node: BookmarkNode; score: number } | null = null;
      for (const slot of snapshot.folders) {
        if (slot.hasBookmarks) continue;
        const node = findNode(tree, slot.id);
        if (!node?.children) continue;
        const score = distanceToRect(clientX, clientY, slot.rect);
        if (!nearestFolder || score < nearestFolder.score) nearestFolder = { node, score };
      }

      if (nearestBookmark && (!nearestFolder || nearestBookmark.score <= nearestFolder.score)) {
        const position = getRelativeDropPosition(
          item,
          nearestBookmark.node,
          "bookmark",
          clientX,
          clientY,
          nearestBookmark.rect
        );
        queueDragPreview({
          key: `bookmark:${nearestBookmark.node.id}:${position}`,
          x: clientX,
          y: clientY,
          target: { kind: "bookmark", id: nearestBookmark.node.id, position },
          apply: () => previewRelativeMove(item, nearestBookmark!.node, "bookmark", position),
        });
      } else if (nearestFolder) {
        queueDragPreview({
          key: `inside:${nearestFolder.node.id}`,
          x: clientX,
          y: clientY,
          target: { kind: "inside", id: nearestFolder.node.id },
          apply: () => previewInsideMove(item, nearestFolder!.node),
        });
      }
      return;
    }

    const candidate = getFolderDropCandidate(item, snapshot, clientX, clientY);
    if (candidate) queueDragPreview(candidate);
  };

  const handleGlobalDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!dragData.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    updateDragPreviewAt(e.clientX, e.clientY);
  };

  const handleRelativeDrop = async (
    e: React.DragEvent<HTMLElement>,
    target: BookmarkNode,
    type: DragItem["type"]
  ) => {
    const item = readDragItem(e);
    if (!item || item.type !== type) return;
    e.preventDefault();
    e.stopPropagation();
    const hadCommittedTarget = !!committedDropTarget.current;
    let committed = false;
    try {
      committed = await commitAcceptedDropTarget(item);
    } finally {
      if (hadCommittedTarget) clearDragState();
    }
    if (committed || hadCommittedTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const finalTarget = target;
    if (finalTarget.id === item.node.id) return clearDragState();
    if (
      type === "folder" &&
      (finalTarget.parentId === "0" || findNode(item.node.children || [], finalTarget.id))
    ) return clearDragState();
    const position = getRelativeDropPosition(
      item,
      finalTarget,
      type,
      e.clientX,
      e.clientY,
      rect
    );
    const destination = getRelativeMoveDestination(item.node, finalTarget, position);
    if (!destination) return clearDragState();
    try {
      await onMove(item.node.id, destination.parentId, destination.index);
    } finally {
      clearDragState();
    }
  };

  const commitAcceptedDropTarget = async (item: DragItem): Promise<boolean> => {
    const acceptedDropTarget = committedDropTarget.current;
    if (!acceptedDropTarget) return false;

    if (acceptedDropTarget.kind === "inside") {
      const acceptedFolder = findNode(tree, acceptedDropTarget.id);
      if (
        acceptedFolder?.children &&
        item.node.id !== acceptedFolder.id &&
        !(item.type === "folder" && findNode(item.node.children || [], acceptedFolder.id))
      ) {
        await onMove(item.node.id, acceptedFolder.id, undefined);
        return true;
      }
      return false;
    }

    if (acceptedDropTarget.kind !== item.type) return false;
    const acceptedNode = findNode(tree, acceptedDropTarget.id);
    if (!acceptedNode || acceptedNode.id === item.node.id) return false;
    if (
      item.type === "folder" &&
      (acceptedNode.parentId === "0" || findNode(item.node.children || [], acceptedNode.id))
    ) return false;

    const destination = getRelativeMoveDestination(
      item.node,
      acceptedNode,
      acceptedDropTarget.position
    );
    if (!destination) return false;
    await onMove(item.node.id, destination.parentId, destination.index);
    return true;
  };

  const handleSectionDrop = async (e: React.DragEvent, folder: BookmarkNode) => {
    e.preventDefault();
    e.stopPropagation();
    const item = readDragItem(e);
    if (!item) return clearDragState();

    const hadCommittedTarget = !!committedDropTarget.current;
    let committed = false;
    try {
      committed = await commitAcceptedDropTarget(item);
    } finally {
      if (hadCommittedTarget) clearDragState();
    }
    if (committed || hadCommittedTarget) return;

    if (item.node.id === folder.id) return clearDragState();
    if (item.type === "folder" && findNode(item.node.children || [], folder.id)) {
      return clearDragState();
    }
    if (item.type === "folder") return clearDragState();
    try {
      await onMove(item.node.id, folder.id, undefined);
    } finally {
      clearDragState();
    }
  };

  const handleGridDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const target = committedDropTarget.current;
    const targetNode = target ? findNode(tree, target.id) : null;
    if (!targetNode) {
      e.preventDefault();
      clearDragState();
      return;
    }
    void handleSectionDrop(e, targetNode);
  };

  documentDragOverHandler.current = (event) => {
    handleGlobalDragOver(event as unknown as React.DragEvent<HTMLDivElement>);
  };
  documentDropHandler.current = (event) => {
    handleGridDrop(event as unknown as React.DragEvent<HTMLDivElement>);
  };

  const handleFolderRightClick = (e: React.MouseEvent, node: BookmarkNode) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  };

  const activeFolderSection = sortMode !== "time" && activeFolderId
    ? orderedFolderSections.find((section) => section.folder.id === activeFolderId) || null
    : null;
  const activeTimeGroup = sortMode === "time" && activeTimeGroupLabel
    ? timeGroups.find((group) => group.label === activeTimeGroupLabel) || null
    : null;
  const activeDetail = activeFolderSection
    ? {
        kind: "folder" as const,
        id: activeFolderSection.folder.id,
        title: activeFolderSection.folder.title,
        breadcrumbLabel: activeFolderSection.breadcrumbLabel,
        bookmarks: activeFolderSection.bookmarks,
        draggableBookmarks: !searchQuery,
      }
    : activeTimeGroup
    ? {
        kind: "time" as const,
        id: activeTimeGroup.label,
        title: activeTimeGroup.label,
        breadcrumbLabel: "",
        bookmarks: activeTimeGroup.bookmarks,
        draggableBookmarks: false,
      }
    : null;

  const detailColumnCount = Math.max(1, masonryColumnCount || 1);
  const detailRowCount = activeDetail
    ? Math.max(1, Math.ceil(activeDetail.bookmarks.length / detailColumnCount))
    : 1;
  const detailPreviewLimit = detailRowCount > DEFAULT_FOLDER_PREVIEW_LIMIT
    ? DEFAULT_FOLDER_PREVIEW_LIMIT * 2
    : DEFAULT_FOLDER_PREVIEW_LIMIT;
  const detailHeight = getFolderSnappedHeight(detailPreviewLimit, uiScale) + GRID_SECTION_PADDING * 2 * uiScale;

  useEffect(() => {
    if (!activeFolderId) return;
    if (sortMode === "time" || !orderedFolderSections.some((section) => section.folder.id === activeFolderId)) {
      setActiveFolderId(null);
    }
  }, [activeFolderId, orderedFolderSections, sortMode]);

  useEffect(() => {
    if (!activeTimeGroupLabel) return;
    if (sortMode !== "time" || !timeGroups.some((group) => group.label === activeTimeGroupLabel)) {
      setActiveTimeGroupLabel(null);
      onDetailActiveChange?.(false);
    }
  }, [activeTimeGroupLabel, onDetailActiveChange, sortMode, timeGroups]);

  useEffect(() => {
    if (!activeFolderId && !activeTimeGroupLabel && !isClosingDetail) {
      onDetailActiveChange?.(false);
    }
  }, [activeFolderId, activeTimeGroupLabel, isClosingDetail, onDetailActiveChange]);

  useLayoutEffect(() => {
    if (!activeDetail) return;
    const grid = gridRef.current;
    const layout = grid?.closest<HTMLElement>(".grid-layout");
    if (!layout) return;
    const updateTop = () => {
      setDetailViewportTop(Math.max(0, layout.getBoundingClientRect().top));
    };
    updateTop();
    const observer = new ResizeObserver(updateTop);
    observer.observe(layout);
    window.addEventListener("resize", updateTop);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateTop);
    };
  }, [activeDetail]);

  const hasItems = sortMode !== "time" ? displayedFolderSections.length > 0 : timeGroups.length > 0;
  const renderedSectionCount = sortMode !== "time" ? displayedFolderSections.length : timeGroups.length;

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid || renderedSectionCount === 0) return;
    const container = grid.parentElement;
    if (!container) return;

    const updateColumnCount = () => {
      const gridStyles = getComputedStyle(grid);
      const containerStyles = getComputedStyle(container);
      const firstSection = grid.querySelector<HTMLElement>(".grid-section");
      const firstCard = grid.querySelector<HTMLElement>(".grid-card");
      const measuredCellWidth = firstSection?.getBoundingClientRect().width
        || firstCard?.getBoundingClientRect().width
        || 240 * uiScale;
      const measuredColumnGap = Number.parseFloat(gridStyles.columnGap);
      const cellWidth = measuredCellWidth;
      const columnGap = Number.isFinite(measuredColumnGap) ? measuredColumnGap : 12 * uiScale;
      const availableWidth = Math.max(
        0,
        container.clientWidth
          - Number.parseFloat(containerStyles.paddingLeft)
          - Number.parseFloat(containerStyles.paddingRight)
      );
      const availableColumns = Math.max(
        1,
        Math.floor((availableWidth + columnGap) / (cellWidth + columnGap))
      );
      const nextColumnCount = Math.min(renderedSectionCount, availableColumns);
      const nextMasonryWidth = nextColumnCount * cellWidth + (nextColumnCount - 1) * columnGap;
      setMasonryColumnCount(nextColumnCount);
      setMasonryWidth(nextMasonryWidth);
    };

    updateColumnCount();
    const observer = new ResizeObserver(updateColumnCount);
    observer.observe(container);
    return () => observer.disconnect();
  }, [renderedSectionCount, uiScale]);

  if (!hasItems) {
    return (
      <div className="grid-view-empty">
        <p>{searchQuery ? t("no_matching") : t("no_bookmarks")}</p>
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      onDrop={handleGridDrop}
      onContextMenu={onBackgroundContextMenu}
      className={`grid-view ${activeDetail ? "has-detail-overlay" : ""}`}
      style={masonryColumnCount
        ? {
            width: masonryWidth,
            gridTemplateColumns: `repeat(${masonryColumnCount}, var(--grid-section-width))`,
          }
        : undefined}
    >
      {/* Folder mode — centered masonry columns */}
      {sortMode !== "time" &&
        folderMasonryColumns.map((column, columnIndex) => (
          <div className="grid-masonry-column" key={`folder-column-${columnIndex}`}>
            {column.map((section) => {
              const previewLimit = resizingPreview?.folderId === section.folder.id
                ? resizingPreview.limit
                : getFolderPreviewLimit(section.folder.id);
              const renderLimit = getFolderRenderLimit(previewLimit, uiScale);
              const snappedHeight = getFolderSnappedHeight(previewLimit, uiScale);
              const isHiddenFolder = hiddenFolderIds.has(section.folder.id);
              const hiddenToggleLabel = t(isHiddenFolder ? "show_folder" : "hide_folder");
              return (
          <div
            key={section.folder.id}
            data-folder-id={section.folder.id}
            data-drag-layout-id={`folder:${section.folder.id}`}
            style={{
              height: draggingItem
                ? dragLayoutSnapshot.current?.folders.find(
                    (slot) => slot.id === section.folder.id
                  )?.height || snappedHeight
                : snappedHeight,
            }}
            className={`grid-section ${isHiddenFolder ? "is-hidden-folder" : ""} ${resizingPreview?.folderId === section.folder.id ? "is-resizing" : ""} ${draggingItem?.type === "folder" && draggingItem.node.id === section.folder.id ? "dragging" : ""} ${dropTarget?.kind === "inside" && dropTarget.id === section.folder.id ? "drop-inside" : ""} ${dropTarget?.kind === "folder" && dropTarget.id === section.folder.id ? `drop-${dropTarget.position}` : ""}`}
            onDrop={(e) => void handleSectionDrop(e, section.folder)}
          >
            <div
              className="grid-section-header"
              onClick={() => {
                setIsClosingDetail(false);
                setActiveTimeGroupLabel(null);
                setActiveFolderId(section.folder.id);
                onDetailActiveChange?.(true);
              }}
              onContextMenu={(e) => handleFolderRightClick(e, section.folder)}
              draggable={!searchQuery && section.folder.parentId !== "0" && section.folder.id !== "0"}
              onDragStart={(e) => handleDragStart(e, section.folder, "folder")}
              onDrop={(e) => void handleRelativeDrop(e, section.folder, "folder")}
              onDragEnd={clearDragState}
            >
              <Folder className="grid-section-icon" size={15} strokeWidth={2} aria-hidden="true" />
              <div className="grid-section-title-wrap">
                <h2 className="grid-section-title">{section.folder.title}</h2>
                {section.breadcrumbLabel && (
                  <span className="grid-section-path">{section.breadcrumbLabel}</span>
                )}
                {section.breadcrumb.length > 0 && (
                  <span className="grid-section-breadcrumb">
                    {section.breadcrumb.join(" 鈥?")}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="grid-section-hide-button"
                aria-label={hiddenToggleLabel}
                title={hiddenToggleLabel}
                draggable={false}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFolderHidden(section.folder);
                }}
                onDragStart={(e) => e.preventDefault()}
              >
                {isHiddenFolder ? <Eye size={13} strokeWidth={2} /> : <EyeOff size={13} strokeWidth={2} />}
              </button>
              <span className="grid-section-count">
                {section.bookmarks.length}
              </span>
            </div>
            <div className="grid-section-collapse">
              <div className="grid-section-collapse-inner">
                <div className="grid-section-body">
                  {Array.from({ length: renderLimit }).map((_, index) => {
                    const bm = section.bookmarks[index];
                    return bm ? (
                      <BookmarkCard
                        key={bm.id}
                        bm={bm}
                        layoutId={`${section.folder.id}:bookmark:${bm.id}`}
                        draggableAllowed={!searchQuery}
                        isDragging={draggingItem?.type === "bookmark" && draggingItem.node.id === bm.id}
                        isPreview={
                          crossFolderPreview?.bookmark.id === bm.id &&
                          crossFolderPreview.targetFolderId === section.folder.id &&
                          bm.parentId === section.folder.id
                        }
                        onDragStart={handleDragStart}
                        dropPosition={dropTarget?.kind === "bookmark" && dropTarget.id === bm.id ? dropTarget.position : undefined}
                        onDrop={(e) => void handleRelativeDrop(e, bm, "bookmark")}
                        onDragEnd={clearDragState}
                        onClick={handleCardClick}
                        onContextMenu={onContextMenu}
                        linkStatus={getLinkStatus ? getLinkStatus(bm.id) : undefined}
                        simplifyTitle={simplifyTitles}
                      />
                    ) : (
                      <div
                        key={`${section.folder.id}:empty-slot:${index}`}
                        className="grid-card-placeholder"
                        aria-hidden="true"
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            <div
              className="grid-section-resize-handle"
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize folder preview"
              title="拖动调整显示数量"
              onPointerDown={(e) => handleFolderResizeStart(e, section.folder.id)}
            />
              </div>
              );
            })}
          </div>
        ))}

      {/* Time mode */}
      {sortMode === "time" &&
        timeMasonryColumns.map((column, columnIndex) => (
          <div className="grid-masonry-column" key={`time-column-${columnIndex}`}>
            {column.map((group) => (
              <div
                key={group.label}
                className="grid-section"
                data-drag-layout-id={`time:${group.label}`}
                style={{ height: getFolderSnappedHeight(DEFAULT_FOLDER_PREVIEW_LIMIT, uiScale) }}
              >
                <div
                  className="grid-section-header"
                  onClick={() => {
                    setIsClosingDetail(false);
                    setActiveFolderId(null);
                    setActiveTimeGroupLabel(group.label);
                    onDetailActiveChange?.(true);
                  }}
                >
                  <Clock3 className="grid-section-icon" size={15} strokeWidth={2} aria-hidden="true" />
                  <div className="grid-section-title-wrap">
                    <h2 className="grid-section-title">{group.label}</h2>
                  </div>
                  <span className="grid-section-count">{group.bookmarks.length}</span>
                </div>
                <div className="grid-section-collapse">
                  <div className="grid-section-collapse-inner">
                    <div className="grid-section-body">
                      {Array.from({ length: DEFAULT_FOLDER_PREVIEW_LIMIT }).map((_, index) => {
                        const bm = group.bookmarks[index];
                        return bm ? (
                          <BookmarkCard
                            key={bm.id}
                            bm={bm}
                            layoutId={`time:${group.label}:bookmark:${bm.id}`}
                            draggableAllowed={false}
                            isDragging={draggingItem?.type === "bookmark" && draggingItem.node.id === bm.id}
                            onDragStart={handleDragStart}
                            onDrop={(e) => void handleRelativeDrop(e, bm, "bookmark")}
                            onDragEnd={clearDragState}
                            onClick={handleCardClick}
                            onContextMenu={onContextMenu}
                            linkStatus={getLinkStatus ? getLinkStatus(bm.id) : undefined}
                            simplifyTitle={simplifyTitles}
                          />
                        ) : (
                          <div
                            key={`time:${group.label}:empty-slot:${index}`}
                            className="grid-card-placeholder"
                            aria-hidden="true"
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

      {activeDetail && (
        <div
          className={`folder-detail-view ${isClosingDetail ? "is-closing" : ""}`}
          style={{
            "--folder-detail-top": `${detailViewportTop}px`,
            "--folder-detail-panel-width": masonryWidth ? `${masonryWidth}px` : "100%",
          } as React.CSSProperties}
          onContextMenu={onBackgroundContextMenu}
          onClick={closeActiveDetail}
        >
          <section
            className="folder-detail-panel"
            style={{
              "--folder-detail-columns": detailColumnCount,
              height: detailHeight,
            } as React.CSSProperties}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="folder-detail-header">
              <button
                type="button"
                className="folder-detail-back"
                onClick={closeActiveDetail}
                aria-label="Back to folders"
              >
                <ArrowLeft size={15} />
              </button>
              <div className="folder-detail-title-wrap">
                <Folder className="grid-section-icon" size={15} strokeWidth={2} aria-hidden="true" />
                <h2 className="folder-detail-title">{activeDetail.title}</h2>
                {activeDetail.breadcrumbLabel && (
                  <span className="grid-section-path">{activeDetail.breadcrumbLabel}</span>
                )}
              </div>
              <span className="folder-detail-count">
                {t("bookmark_count", { count: activeDetail.bookmarks.length })}
              </span>
            </div>
            {activeDetail.bookmarks.length > 0 ? (
              <div className="folder-detail-grid">
                {activeDetail.bookmarks.map((bm) => (
                  <BookmarkCard
                    key={bm.id}
                    bm={bm}
                    layoutId={`${activeDetail.kind}:${activeDetail.id}:detail-bookmark:${bm.id}`}
                    draggableAllowed={activeDetail.draggableBookmarks}
                    isDragging={draggingItem?.type === "bookmark" && draggingItem.node.id === bm.id}
                    onDragStart={handleDragStart}
                    dropPosition={activeDetail.draggableBookmarks && dropTarget?.kind === "bookmark" && dropTarget.id === bm.id ? dropTarget.position : undefined}
                    onDrop={(e) => void handleRelativeDrop(e, bm, "bookmark")}
                    onDragEnd={clearDragState}
                    onClick={handleCardClick}
                    onContextMenu={onContextMenu}
                    linkStatus={getLinkStatus ? getLinkStatus(bm.id) : undefined}
                    simplifyTitle={simplifyTitles}
                  />
                ))}
              </div>
            ) : (
              <div className="folder-detail-empty">
                {t("folder_empty")}
              </div>
            )}
          </section>
        </div>
      )}

    </div>
  );
}

// 鈹€鈹€鈹€ Bookmark Card 鈹€鈹€鈹€

function safeFaviconUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
  } catch {
    return "";
  }
}

function BookmarkCard({
  bm,
  layoutId,
  draggableAllowed = true,
  isDragging = false,
  isPreview = false,
  onDragStart,
  dropPosition,
  onDrop,
  onDragEnd,
  onClick,
  onContextMenu,
  linkStatus: status,
  simplifyTitle,
}: {
  bm: BookmarkNode;
  layoutId: string;
  draggableAllowed?: boolean;
  isDragging?: boolean;
  isPreview?: boolean;
  onDragStart: (e: React.DragEvent, node: BookmarkNode, type: DragItem["type"]) => void;
  dropPosition?: DropPosition;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onClick: (bm: BookmarkNode) => void;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
  linkStatus?: LinkStatus;
  simplifyTitle: boolean;
}) {
  const { t } = useI18n();

  return (
    <div
      data-drag-layout-id={layoutId}
      data-bookmark-id={bm.id}
      className={`grid-card ${isDragging ? "is-dragging" : ""} ${isPreview ? "drag-preview-card" : ""} ${dropPosition ? `drop-${dropPosition}` : ""} ${status !== "unknown" ? `link-${status}` : ""}`}
      draggable={!isPreview && draggableAllowed}
      onDragStart={!isPreview && draggableAllowed ? (e) => onDragStart(e, bm, "bookmark") : undefined}
      onDrop={isPreview ? undefined : onDrop}
      onDragEnd={isPreview ? undefined : onDragEnd}
      onClick={isPreview ? undefined : () => onClick(bm)}
      onContextMenu={isPreview ? undefined : (e) => onContextMenu(e, bm)}
      title={`${bm.title}\n${bm.url}`}
    >
      <img
        className="grid-card-favicon"
        src={safeFaviconUrl(bm.url)}
        alt=""
        loading="lazy"
        decoding="async"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <span className="grid-card-title">
        {simplifyTitle
          ? simplifyBookmarkTitle(bm.title || t("untitled"))
          : bm.title || t("untitled")}
      </span>
      {status === "checking" && (
        <span className="grid-card-status status-checking" title={t("link_checking")} aria-label={t("link_checking")} />
      )}
      {status === "valid" && (
        <span className="grid-card-status status-valid" title={t("link_valid")} aria-label={t("link_valid")} />
      )}
      {status === "broken" && (
        <span className="grid-card-status status-broken" title={t("link_broken")} aria-label={t("link_broken")} />
      )}
    </div>
  );
}
