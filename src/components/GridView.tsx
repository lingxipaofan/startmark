import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { ChevronDown } from "lucide-react";
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
  getLinkStatus?: (id: string) => LinkStatus;
  sortMode: SortMode;
  alphabeticalDirection: AlphabeticalDirection;
  simplifyTitles: boolean;
  showRootFolders: boolean;
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
  getLinkStatus,
  sortMode,
  alphabeticalDirection,
  simplifyTitles,
  showRootFolders,
  uiScale,
}: Props) {
  const { t } = useI18n();
  const [dragPreviewOrder, setDragPreviewOrder] = useState<DragOrderState | null>(null);
  const [crossFolderPreview, setCrossFolderPreview] = useState<{
    bookmark: BookmarkNode;
    targetFolderId: string;
  } | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [masonryColumnCount, setMasonryColumnCount] = useState<number>();
  const [masonryWidth, setMasonryWidth] = useState<number>();
  const gridRef = useRef<HTMLDivElement>(null);
  const dragData = useRef<DragItem | null>(null);
  const dragOriginRect = useRef<DOMRect | null>(null);
  const dragLayoutSnapshot = useRef<DragLayoutSnapshot | null>(null);
  const dragBaseOrder = useRef<DragOrderState | null>(null);
  const committedDragPreview = useRef<{ key: string; x: number; y: number } | null>(null);
  const committedDropTarget = useRef<DropTarget | null>(null);
  const layoutRectsBeforePreview = useRef<Map<string, DOMRect> | null>(null);
  const layoutAnimations = useRef<Map<string, Animation>>(new Map());
  const collapseLayoutPositions = useRef<Map<string, { left: number; top: number }> | null>(null);
  const collapseTrackingFrame = useRef<number | null>(null);
  const documentDragOverHandler = useRef<(event: DragEvent) => void>(() => undefined);
  const documentDropHandler = useRef<(event: DragEvent) => void>(() => undefined);
  const [draggingItem, setDraggingItem] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const sections = useMemo(() => {
    const result: FolderSection[] = [];
    const walk = (nodes: BookmarkNode[], ancestors: BookmarkNode[] = []) => {
      for (const node of nodes) {
        if (!node.children) continue;
        const directBms = node.children.filter((c) => !!c.url);
        const isBrowserRoot = node.id === "0";
        const isRootContainer = node.parentId === "0";
        if (!isBrowserRoot && (!isRootContainer || showRootFolders)) {
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
  }, [tree, showRootFolders]);

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
    if (!searchQuery) return orderedFolderSections;
    const query = searchQuery.toLowerCase();
    return orderedFolderSections
      .map((section) => ({
        ...section,
        bookmarks: section.bookmarks.filter(
          (bookmark) =>
            bookmark.title.toLowerCase().includes(query) ||
            (bookmark.url || "").toLowerCase().includes(query)
        ),
      }))
      .filter((section) => section.bookmarks.length > 0);
  }, [orderedFolderSections, searchQuery]);

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
      (section) => collapsedSections.has(section.folder.id)
        ? 1
        : 1 + Math.max(0, section.bookmarks.length)
    ),
    [displayedFolderSections, activeMasonryColumnCount, collapsedSections]
  );

  const timeMasonryColumns = useMemo(
    () => buildMasonryColumns(
      timeGroups,
      activeMasonryColumnCount,
      (group) => 1 + group.bookmarks.length
    ),
    [timeGroups, activeMasonryColumnCount]
  );

  const toggleSection = (id: string) => {
    const positions = new Map<string, { left: number; top: number }>();
    gridRef.current?.querySelectorAll<HTMLElement>(".grid-section[data-folder-id]").forEach((element) => {
      const folderId = element.dataset.folderId;
      if (folderId) positions.set(folderId, { left: element.offsetLeft, top: element.offsetTop });
    });
    collapseLayoutPositions.current = positions;
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCardClick = (bm: BookmarkNode) => {
    if (bm.url) chrome.tabs.update({ url: bm.url });
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
    const grid = gridRef.current;
    dragLayoutSnapshot.current = grid
      ? {
          bookmarks: Array.from(
            grid.querySelectorAll<HTMLElement>("[data-bookmark-id]:not(.drag-preview-card)")
          )
            .filter((element) => !element.closest(".grid-section-collapse.collapsed"))
            .map((element) => ({
              id: element.dataset.bookmarkId!,
              rect: element.getBoundingClientRect(),
            })),
          folders: Array.from(
            grid.querySelectorAll<HTMLElement>(".grid-section[data-folder-id]")
          ).map((element) => ({
            id: element.dataset.folderId!,
            rect: element.getBoundingClientRect(),
            height: element.getBoundingClientRect().height,
            hasBookmarks:
              !element.querySelector(".grid-section-collapse.collapsed") &&
              !!element.querySelector("[data-bookmark-id]:not(.drag-preview-card)"),
          })),
        }
      : null;
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
    gridRef.current?.querySelectorAll<HTMLElement>("[data-drag-layout-id]").forEach((element) => {
      const id = element.dataset.dragLayoutId;
      if (id) rects.set(id, element.getBoundingClientRect());
    });
    layoutRectsBeforePreview.current = rects;
  };

  const queueDragPreview = (candidate: PendingDragPreview) => {
    const committed = committedDragPreview.current;
    if (committed?.key === candidate.key) return;
    if (
      committed &&
      Math.hypot(candidate.x - committed.x, candidate.y - committed.y) <
        DRAG_PREVIEW_UNLOCK_DISTANCE
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
    gridRef.current?.querySelectorAll<HTMLElement>("[data-drag-layout-id]").forEach((element) => {
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
  }, [dragPreviewOrder, crossFolderPreview]);

  useLayoutEffect(() => {
    const positions = collapseLayoutPositions.current;
    if (!positions || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      collapseLayoutPositions.current = null;
      return;
    }
    if (collapseTrackingFrame.current !== null) {
      cancelAnimationFrame(collapseTrackingFrame.current);
    }
    const trackingStartedAt = performance.now();
    const trackColumnMoves = () => {
      gridRef.current?.querySelectorAll<HTMLElement>(".grid-section[data-folder-id]").forEach((element) => {
        const id = element.dataset.folderId;
        if (!id) return;
        const previous = positions.get(id);
        const current = { left: element.offsetLeft, top: element.offsetTop };
        positions.set(id, current);
        if (!previous) return;
        const layoutDeltaX = previous.left - current.left;
        const layoutDeltaY = previous.top - current.top;
        // Small vertical changes are already animated by the collapsing body.
        // FLIP only the discontinuous masonry jump to another column/slot.
        if (Math.abs(layoutDeltaX) < 8 && Math.abs(layoutDeltaY) < 40) return;

        const animationKey = `collapse-folder:${id}`;
        const runningAnimation = layoutAnimations.current.get(animationKey);
        let deltaX = layoutDeltaX;
        let deltaY = layoutDeltaY;
        if (runningAnimation) {
          const visualPosition = element.getBoundingClientRect();
          runningAnimation.cancel();
          const layoutPosition = element.getBoundingClientRect();
          deltaX = visualPosition.left - layoutPosition.left;
          deltaY = visualPosition.top - layoutPosition.top;
        }
        const animation = element.animate(
          [
            { transform: `translate(${deltaX}px, ${deltaY}px)` },
            { transform: "translate(0, 0)" },
          ],
          { duration: 240, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
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

      if (performance.now() - trackingStartedAt < 300) {
        collapseTrackingFrame.current = requestAnimationFrame(trackColumnMoves);
      } else {
        collapseTrackingFrame.current = null;
        collapseLayoutPositions.current = null;
      }
    };
    collapseTrackingFrame.current = requestAnimationFrame(trackColumnMoves);
    return () => {
      if (collapseTrackingFrame.current !== null) {
        cancelAnimationFrame(collapseTrackingFrame.current);
        collapseTrackingFrame.current = null;
      }
    };
  }, [collapsedSections]);

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

  const handleGlobalDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const item = dragData.current;
    const grid = gridRef.current;
    const snapshot = dragLayoutSnapshot.current;
    if (!item || !grid || !snapshot) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const origin = dragOriginRect.current;
    if (
      !committedDropTarget.current &&
      origin &&
      e.clientX >= origin.left - 4 &&
      e.clientX <= origin.right + 4 &&
      e.clientY >= origin.top - 4 &&
      e.clientY <= origin.bottom + 4
    ) return;

    if (item.type === "bookmark") {
      let nearestBookmark: { node: BookmarkNode; rect: DOMRect; score: number } | null = null;
      for (const slot of snapshot.bookmarks) {
        if (slot.id === item.node.id) continue;
        const node = findNode(tree, slot.id);
        if (!node?.url) continue;
        const score = distanceToRect(e.clientX, e.clientY, slot.rect);
        if (!nearestBookmark || score < nearestBookmark.score) {
          nearestBookmark = { node, rect: slot.rect, score };
        }
      }

      let nearestFolder: { node: BookmarkNode; score: number } | null = null;
      for (const slot of snapshot.folders) {
        if (slot.hasBookmarks) continue;
        const node = findNode(tree, slot.id);
        if (!node?.children) continue;
        const score = distanceToRect(e.clientX, e.clientY, slot.rect);
        if (!nearestFolder || score < nearestFolder.score) nearestFolder = { node, score };
      }

      if (nearestBookmark && (!nearestFolder || nearestBookmark.score <= nearestFolder.score)) {
        const position: DropPosition = e.clientY < nearestBookmark.rect.top + nearestBookmark.rect.height / 2
          ? "before"
          : "after";
        queueDragPreview({
          key: `bookmark:${nearestBookmark.node.id}:${position}`,
          x: e.clientX,
          y: e.clientY,
          target: { kind: "bookmark", id: nearestBookmark.node.id, position },
          apply: () => previewRelativeMove(item, nearestBookmark!.node, "bookmark", position),
        });
      } else if (nearestFolder) {
        queueDragPreview({
          key: `inside:${nearestFolder.node.id}`,
          x: e.clientX,
          y: e.clientY,
          target: { kind: "inside", id: nearestFolder.node.id },
          apply: () => previewInsideMove(item, nearestFolder!.node),
        });
      }
      return;
    }

    let nearestFolder: { node: BookmarkNode; rect: DOMRect; score: number } | null = null;
    for (const slot of snapshot.folders) {
      if (slot.id === item.node.id) continue;
      const node = findNode(tree, slot.id);
      if (!node?.children || node.parentId === "0" || findNode(item.node.children || [], slot.id)) continue;
      const score = distanceToRect(e.clientX, e.clientY, slot.rect);
      if (!nearestFolder || score < nearestFolder.score) {
        nearestFolder = { node, rect: slot.rect, score };
      }
    }
    if (!nearestFolder) return;
    const rect = nearestFolder.rect;
    const edgeX = rect.width * 0.22;
    const edgeY = rect.height * 0.28;
    const isInsideIntent =
      e.clientX > rect.left + edgeX &&
      e.clientX < rect.right - edgeX &&
      e.clientY > rect.top + edgeY &&
      e.clientY < rect.bottom - edgeY;
    if (isInsideIntent) {
      queueDragPreview({
        key: `inside:${nearestFolder.node.id}`,
        x: e.clientX,
        y: e.clientY,
        target: { kind: "inside", id: nearestFolder.node.id },
        apply: () => previewInsideMove(item, nearestFolder!.node),
      });
      return;
    }
    const useHorizontalEdge = Math.abs(e.clientX - (rect.left + rect.width / 2)) > rect.width * 0.4;
    const position: DropPosition = useHorizontalEdge
      ? e.clientX < rect.left + rect.width / 2 ? "before" : "after"
      : e.clientY < rect.top + rect.height / 2 ? "before" : "after";
    queueDragPreview({
      key: `folder:${nearestFolder.node.id}:${position}`,
      x: e.clientX,
      y: e.clientY,
      target: { kind: "folder", id: nearestFolder.node.id, position },
      apply: () => previewRelativeMove(item, nearestFolder!.node, "folder", position),
    });
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
    const rect = e.currentTarget.getBoundingClientRect();
    const pointerPosition: DropPosition = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
    const acceptedDropTarget = committedDropTarget.current;
    if (acceptedDropTarget?.kind === "inside") {
      const acceptedFolder = findNode(tree, acceptedDropTarget.id);
      if (
        acceptedFolder?.children &&
        item.node.id !== acceptedFolder.id &&
        !(item.type === "folder" && findNode(item.node.children || [], acceptedFolder.id))
      ) {
        try {
          await onMove(item.node.id, acceptedFolder.id, undefined);
        } finally {
          clearDragState();
        }
        return;
      }
    }
    const acceptedNode = acceptedDropTarget?.kind === type
      ? findNode(tree, acceptedDropTarget.id)
      : null;
    const finalTarget = acceptedNode && acceptedNode.id !== item.node.id ? acceptedNode : target;
    if (finalTarget.id === item.node.id) return clearDragState();
    if (
      type === "folder" &&
      (finalTarget.parentId === "0" || findNode(item.node.children || [], finalTarget.id))
    ) return clearDragState();
    const position = acceptedNode && acceptedDropTarget?.kind === type
      ? acceptedDropTarget.position
      : pointerPosition;
    const destination = getRelativeMoveDestination(item.node, finalTarget, position);
    if (!destination) return clearDragState();
    try {
      await onMove(item.node.id, destination.parentId, destination.index);
    } finally {
      clearDragState();
    }
  };

  const handleSectionDrop = async (e: React.DragEvent, folder: BookmarkNode) => {
    e.preventDefault();
    e.stopPropagation();
    const item = readDragItem(e);
    if (!item) return clearDragState();
    const acceptedDropTarget = committedDropTarget.current;

    // A live reorder can place the dragged placeholder itself under the
    // pointer. In that case the section receives the drop, but the intended
    // destination is still the last previewed sibling position.
    if (acceptedDropTarget?.kind === item.type) {
      const acceptedNode = findNode(tree, acceptedDropTarget.id);
      if (acceptedNode && acceptedNode.id !== item.node.id) {
        const destination = getRelativeMoveDestination(
          item.node,
          acceptedNode,
          acceptedDropTarget.position
        );
        if (!destination) return clearDragState();
        try {
          await onMove(item.node.id, destination.parentId, destination.index);
        } finally {
          clearDragState();
        }
        return;
      }
    }

    if (item.node.id === folder.id) return clearDragState();
    if (item.type === "folder" && findNode(item.node.children || [], folder.id)) {
      return clearDragState();
    }
    const acceptedFolder = acceptedDropTarget?.kind === "inside"
      ? findNode(tree, acceptedDropTarget.id)
      : null;
    const finalFolder = acceptedFolder?.children ? acceptedFolder : folder;
    try {
      await onMove(item.node.id, finalFolder.id, undefined);
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
      className="grid-view"
      style={masonryColumnCount
        ? {
            width: masonryWidth,
            gridTemplateColumns: `repeat(${masonryColumnCount}, var(--grid-cell-width))`,
          }
        : undefined}
    >
      {/* Folder mode 鈥?centered masonry columns */}
      {sortMode !== "time" &&
        folderMasonryColumns.map((column, columnIndex) => (
          <div className="grid-masonry-column" key={`folder-column-${columnIndex}`}>
            {column.map((section) => (
              <div
            key={section.folder.id}
            data-folder-id={section.folder.id}
            data-drag-layout-id={`folder:${section.folder.id}`}
            style={draggingItem
              ? {
                  height: dragLayoutSnapshot.current?.folders.find(
                    (slot) => slot.id === section.folder.id
                  )?.height,
                }
              : undefined}
            className={`grid-section ${draggingItem?.type === "folder" && draggingItem.node.id === section.folder.id ? "dragging" : ""} ${dropTarget?.kind === "inside" && dropTarget.id === section.folder.id ? "drop-inside" : ""} ${dropTarget?.kind === "folder" && dropTarget.id === section.folder.id ? `drop-${dropTarget.position}` : ""}`}
            onDrop={(e) => void handleSectionDrop(e, section.folder)}
          >
            <div
              className="grid-section-header"
              onClick={() => toggleSection(section.folder.id)}
              onContextMenu={(e) => handleFolderRightClick(e, section.folder)}
              draggable={!searchQuery && section.folder.parentId !== "0" && section.folder.id !== "0"}
              onDragStart={(e) => handleDragStart(e, section.folder, "folder")}
              onDrop={(e) => void handleRelativeDrop(e, section.folder, "folder")}
              onDragEnd={clearDragState}
            >
              <span className="grid-section-icon">馃搧</span>
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
              <span className={`grid-section-toggle ${collapsedSections.has(section.folder.id) ? "collapsed" : ""}`} aria-hidden="true">
                <ChevronDown size={15} />
              </span>
            </div>
            <div
              className={`grid-section-collapse ${section.bookmarks.length === 0 ? "empty" : ""} ${collapsedSections.has(section.folder.id) ? "collapsed" : ""}`}
              aria-hidden={collapsedSections.has(section.folder.id)}
            >
              <div className="grid-section-collapse-inner">
                <div className="grid-section-body">
                  {section.bookmarks.map((bm) => (
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
                  ))}
                </div>
              </div>
            </div>
              </div>
            ))}
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
          >
            <div className="grid-section-header">
              <span className="grid-section-icon">馃晲</span>
              <h2 className="grid-section-title">{group.label}</h2>
              <span className="grid-section-count">路 {group.bookmarks.length}</span>
            </div>
            <div className="grid-section-body">
              {group.bookmarks.map((bm) => (
                <BookmarkCard
                  key={bm.id}
                  bm={bm}
                  layoutId={`time:${group.label}:bookmark:${bm.id}`}
                  draggableAllowed={false}
                  isDragging={draggingItem?.type === "bookmark" && draggingItem.node.id === bm.id}
                  onDragStart={handleDragStart}
                  dropPosition={dropTarget?.kind === "bookmark" && dropTarget.id === bm.id ? dropTarget.position : undefined}
                  onDrop={(e) => void handleRelativeDrop(e, bm, "bookmark")}
                  onDragEnd={clearDragState}
                  onClick={handleCardClick}
                  onContextMenu={onContextMenu}
                  linkStatus={getLinkStatus ? getLinkStatus(bm.id) : undefined}
                  simplifyTitle={simplifyTitles}
                />
              ))}
            </div>
              </div>
            ))}
          </div>
        ))}

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
