import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { ArrowUpDown, Check, ChevronDown, Link2, LoaderCircle } from "lucide-react";
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
  type DropPosition,
} from "../lib/bookmark-move";
import {
  moveIdRelative,
  moveIdToEnd,
  orderByIds,
  readCustomOrder,
  writeCustomOrder,
  type CustomOrderState,
} from "../lib/custom-order";

interface Props {
  tree: BookmarkNode[];
  searchQuery: string;
  onMove: (id: string, destinationFolderId: string, index?: number) => void | Promise<void>;
  onContextMenu: (e: React.MouseEvent, node: BookmarkNode) => void;
  onBackgroundContextMenu: (e: React.MouseEvent) => void;
  onCheckLinks?: () => void;
  isCheckingLinks?: boolean;
  brokenCount?: number;
  getLinkStatus?: (id: string) => LinkStatus;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  alphabeticalDirection: AlphabeticalDirection;
  onAlphabeticalDirectionChange: (direction: AlphabeticalDirection) => void;
  simplifyTitles: boolean;
}

interface FolderSection {
  folder: BookmarkNode;
  bookmarks: BookmarkNode[];
  breadcrumb: string[]; // ancestor titles, e.g. ["书签栏", "工作"]
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
  onCheckLinks,
  isCheckingLinks,
  brokenCount,
  getLinkStatus,
  sortMode,
  onSortModeChange,
  alphabeticalDirection,
  onAlphabeticalDirectionChange,
  simplifyTitles,
}: Props) {
  const { t } = useI18n();
  const [sections, setSections] = useState<FolderSection[]>([]);
  const [customOrder, setCustomOrder] = useState<CustomOrderState>(readCustomOrder);
  const [dragPreviewOrder, setDragPreviewOrder] = useState<CustomOrderState | null>(null);
  const [crossFolderPreview, setCrossFolderPreview] = useState<{
    bookmark: BookmarkNode;
    targetFolderId: string;
  } | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [masonryColumnCount, setMasonryColumnCount] = useState<number>();
  const [masonryWidth, setMasonryWidth] = useState<number>();
  const [useSingleRowGrid, setUseSingleRowGrid] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragData = useRef<DragItem | null>(null);
  const dragOriginRect = useRef<DOMRect | null>(null);
  const dragLayoutSnapshot = useRef<DragLayoutSnapshot | null>(null);
  const dragBaseOrder = useRef<CustomOrderState | null>(null);
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
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Build sections: each folder with bookmarks or sub-folders = one column
  useEffect(() => {
    const result: FolderSection[] = [];
    const walk = (nodes: BookmarkNode[], ancestors: BookmarkNode[] = []) => {
      for (const node of nodes) {
        if (!node.children) continue;
        const directBms = node.children.filter((c) => !!c.url);
        result.push({
          folder: node,
          bookmarks: directBms,
          breadcrumb: ancestors.map((a) => a.title),
        });
        walk(node.children, [...ancestors, node]);
      }
    };
    walk(tree);
    setSections(result);
  }, [tree]);

  useEffect(() => {
    if (!showSortMenu) return;
    const handler = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    setTimeout(() => document.addEventListener("click", handler), 0);
    return () => document.removeEventListener("click", handler);
  }, [showSortMenu]);


  useEffect(() => {
    if (!draggingItem) return;
    const handleDocumentDragOver = (event: DragEvent) => documentDragOverHandler.current(event);
    const handleDocumentDrop = (event: DragEvent) => documentDropHandler.current(event);
    document.body.classList.add("drag-active");
    document.addEventListener("dragover", handleDocumentDragOver);
    document.addEventListener("drop", handleDocumentDrop);
    return () => {
      document.body.classList.remove("drag-active");
      document.removeEventListener("dragover", handleDocumentDragOver);
      document.removeEventListener("drop", handleDocumentDrop);
    };
  }, [draggingItem]);

  // Time-sorted — oldest first
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
    const activeCustomOrder = dragPreviewOrder || customOrder;
    const useCustomOrder = dragPreviewOrder !== null || sortMode === "custom";
    const rootSections = sections.filter((section) => section.folder.parentId === "0");
    const regularSections = sections.filter((section) => section.folder.parentId !== "0");
    const orderedRegularSections = useCustomOrder
      ? orderByIds(regularSections, activeCustomOrder.folderIds, (section) => section.folder.id)
      : sortMode === "alphabetical"
      ? sortBookmarkNodes(
          regularSections.map((section) => section.folder),
          sortMode,
          alphabeticalDirection
        ).map((folder) => regularSections.find((section) => section.folder.id === folder.id)!)
      : regularSections;

    return [...rootSections, ...orderedRegularSections].map((section) => {
      const sectionBookmarks = crossFolderPreview?.targetFolderId === section.folder.id
        ? [
            ...section.bookmarks,
            { ...crossFolderPreview.bookmark, parentId: section.folder.id },
          ]
        : section.bookmarks;
      return {
        ...section,
        bookmarks: useCustomOrder
        ? orderByIds(
            sectionBookmarks,
            activeCustomOrder.bookmarkIdsByFolder[section.folder.id] || [],
            (bookmark) => bookmark.id
          )
        : sortBookmarkNodes(sectionBookmarks, sortMode, alphabeticalDirection),
      };
    });
  }, [
    sections,
    sortMode,
    alphabeticalDirection,
    customOrder,
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
    dragBaseOrder.current = createCustomOrderSnapshot();
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

  const cloneCustomOrder = (order: CustomOrderState): CustomOrderState => ({
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

  const createCustomOrderSnapshot = (): CustomOrderState => {
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

  const removeBookmarkFromCustomOrder = (order: CustomOrderState, bookmarkId: string) => {
    for (const folderId of Object.keys(order.bookmarkIdsByFolder)) {
      order.bookmarkIdsByFolder[folderId] = order.bookmarkIdsByFolder[folderId]
        .filter((id) => id !== bookmarkId);
    }
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
      const next = cloneCustomOrder(dragBaseOrder.current || createCustomOrderSnapshot());
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
    const next = cloneCustomOrder(dragBaseOrder.current || createCustomOrderSnapshot());
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
      next.folderIds = moveIdRelative(next.folderIds, item.node.id, folder.id, "after");
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

  const moveInCustomOrder = async (
    id: string,
    parentId: string,
    index: number | undefined,
    nextCustomOrder: CustomOrderState
  ) => {
    // Persist the visual snapshot before refreshing so the previous automatic
    // sort cannot reshuffle unrelated items while Chrome applies the move.
    writeCustomOrder(nextCustomOrder);
    setCustomOrder(nextCustomOrder);
    onSortModeChange("custom");
    await onMove(id, parentId, index);
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
    const nextCustomOrder = dragPreviewOrder
      ? cloneCustomOrder(dragPreviewOrder)
      : createCustomOrderSnapshot();
    if (type === "bookmark") {
      removeBookmarkFromCustomOrder(nextCustomOrder, item.node.id);
      const targetFolderId = finalTarget.parentId!;
      nextCustomOrder.bookmarkIdsByFolder[targetFolderId] = moveIdRelative(
        nextCustomOrder.bookmarkIdsByFolder[targetFolderId] || [],
        item.node.id,
        finalTarget.id,
        position
      );
    } else {
      nextCustomOrder.folderIds = moveIdRelative(
        nextCustomOrder.folderIds,
        item.node.id,
        finalTarget.id,
        position
      );
    }
    try {
      await moveInCustomOrder(
        item.node.id,
        destination.parentId,
        destination.index,
        nextCustomOrder
      );
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
        const nextCustomOrder = dragPreviewOrder
          ? cloneCustomOrder(dragPreviewOrder)
          : createCustomOrderSnapshot();
        if (item.type === "bookmark") {
          removeBookmarkFromCustomOrder(nextCustomOrder, item.node.id);
          const targetFolderId = acceptedNode.parentId!;
          nextCustomOrder.bookmarkIdsByFolder[targetFolderId] = moveIdRelative(
            nextCustomOrder.bookmarkIdsByFolder[targetFolderId] || [],
            item.node.id,
            acceptedNode.id,
            acceptedDropTarget.position
          );
        } else {
          nextCustomOrder.folderIds = moveIdRelative(
            nextCustomOrder.folderIds,
            item.node.id,
            acceptedNode.id,
            acceptedDropTarget.position
          );
        }
        try {
          await moveInCustomOrder(
            item.node.id,
            destination.parentId,
            destination.index,
            nextCustomOrder
          );
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
    const nextCustomOrder = dragPreviewOrder
      ? cloneCustomOrder(dragPreviewOrder)
      : createCustomOrderSnapshot();
    if (item.type === "bookmark") {
      removeBookmarkFromCustomOrder(nextCustomOrder, item.node.id);
      nextCustomOrder.bookmarkIdsByFolder[finalFolder.id] = moveIdToEnd(
        nextCustomOrder.bookmarkIdsByFolder[finalFolder.id] || [],
        item.node.id
      );
    } else {
      nextCustomOrder.folderIds = moveIdRelative(
        nextCustomOrder.folderIds,
        item.node.id,
        finalFolder.id,
        "after"
      );
    }
    try {
      await moveInCustomOrder(item.node.id, finalFolder.id, undefined, nextCustomOrder);
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
      const cellWidth = Number.parseFloat(gridStyles.getPropertyValue("--grid-cell-width")) || 240;
      const columnGap = Number.parseFloat(gridStyles.columnGap) || 12;
      const availableWidth = container.clientWidth
        - Number.parseFloat(containerStyles.paddingLeft)
        - Number.parseFloat(containerStyles.paddingRight);
      const availableColumns = Math.max(
        1,
        Math.floor((availableWidth + columnGap) / (cellWidth + columnGap))
      );
      const nextColumnCount = Math.min(renderedSectionCount, availableColumns);
      setMasonryColumnCount(nextColumnCount);
      setMasonryWidth(nextColumnCount * cellWidth + (nextColumnCount - 1) * columnGap);
      setUseSingleRowGrid(renderedSectionCount <= availableColumns);
    };

    updateColumnCount();
    const observer = new ResizeObserver(updateColumnCount);
    observer.observe(container);
    return () => observer.disconnect();
  }, [renderedSectionCount]);

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
      className={`grid-view ${useSingleRowGrid ? "single-row-grid" : ""}`}
      style={masonryColumnCount
        ? useSingleRowGrid
          ? {
              width: masonryWidth,
              gridTemplateColumns: `repeat(${masonryColumnCount}, var(--grid-cell-width))`,
            }
          : { width: masonryWidth, columnCount: masonryColumnCount }
        : undefined}
    >
      <div className="floating-tool floating-tool-left" ref={sortMenuRef}>
        <button
          type="button"
          className={`floating-tool-button ${showSortMenu ? "active" : ""}`}
          onClick={() => setShowSortMenu((open) => !open)}
          aria-label={t("sort_options")}
          aria-haspopup="menu"
          aria-expanded={showSortMenu}
          title={t("sort_options")}
        >
          <ArrowUpDown size={17} aria-hidden="true" />
        </button>
        {showSortMenu && (
          <div className="sort-popover" role="menu">
            <button
              type="button"
              className={sortMode === "folder" ? "active" : ""}
              onClick={() => {
                onSortModeChange("folder");
                setShowSortMenu(false);
              }}
              role="menuitem"
            >
              <span className="sort-popover-check">{sortMode === "folder" && <Check size={14} />}</span>
              {t("sort_chrome")}
            </button>
            <button
              type="button"
              className={sortMode === "custom" ? "active" : ""}
              onClick={() => {
                onSortModeChange("custom");
                setShowSortMenu(false);
              }}
              role="menuitem"
            >
              <span className="sort-popover-check">{sortMode === "custom" && <Check size={14} />}</span>
              {t("sort_custom")}
            </button>
            <button
              type="button"
              className={sortMode === "alphabetical" && alphabeticalDirection === "asc" ? "active" : ""}
              onClick={() => {
                onAlphabeticalDirectionChange("asc");
                onSortModeChange("alphabetical");
                setShowSortMenu(false);
              }}
              role="menuitem"
            >
              <span className="sort-popover-check">{sortMode === "alphabetical" && alphabeticalDirection === "asc" && <Check size={14} />}</span>
              {t("sort_name_asc")}
            </button>
            <button
              type="button"
              className={sortMode === "alphabetical" && alphabeticalDirection === "desc" ? "active" : ""}
              onClick={() => {
                onAlphabeticalDirectionChange("desc");
                onSortModeChange("alphabetical");
                setShowSortMenu(false);
              }}
              role="menuitem"
            >
              <span className="sort-popover-check">{sortMode === "alphabetical" && alphabeticalDirection === "desc" && <Check size={14} />}</span>
              {t("sort_name_desc")}
            </button>
            <button
              type="button"
              className={sortMode === "time" ? "active" : ""}
              onClick={() => {
                onSortModeChange("time");
                setShowSortMenu(false);
              }}
              role="menuitem"
            >
              <span className="sort-popover-check">{sortMode === "time" && <Check size={14} />}</span>
              {t("sort_by_time")}
            </button>
          </div>
        )}
      </div>

      <div className="floating-tool floating-tool-right">
        <button
          type="button"
          className="floating-tool-button"
          onClick={onCheckLinks}
          disabled={isCheckingLinks || !onCheckLinks}
          aria-label={t("check_links")}
          title={brokenCount ? t("broken_found", { count: brokenCount }) : t("check_links")}
        >
          {isCheckingLinks
            ? <LoaderCircle className="floating-tool-spinner" size={17} aria-hidden="true" />
            : <Link2 size={17} aria-hidden="true" />}
          {!!brokenCount && !isCheckingLinks && (
            <span className="floating-tool-badge" aria-hidden="true">{brokenCount > 99 ? "99+" : brokenCount}</span>
          )}
        </button>
      </div>

      {/* Folder mode — each folder = one column */}
      {sortMode !== "time" &&
        displayedFolderSections.map((section) => (
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
              <span className="grid-section-icon">📁</span>
              <div className="grid-section-title-wrap">
                <h2 className="grid-section-title">{section.folder.title}</h2>
                {section.breadcrumb.length > 0 && (
                  <span className="grid-section-breadcrumb">
                    {section.breadcrumb.join(" › ")}
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

      {/* Time mode */}
      {sortMode === "time" &&
        timeGroups.map((group) => (
          <div
            key={group.label}
            className="grid-section"
            data-drag-layout-id={`time:${group.label}`}
          >
            <div className="grid-section-header">
              <span className="grid-section-icon">🕐</span>
              <h2 className="grid-section-title">{group.label}</h2>
              <span className="grid-section-count">· {group.bookmarks.length}</span>
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
  );
}

// ─── Bookmark Card ───

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
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <span className="grid-card-title">
        {simplifyTitle
          ? simplifyBookmarkTitle(bm.title || t("untitled"))
          : bm.title || t("untitled")}
      </span>
      {status === "checking" && <span className="grid-card-status status-checking">{t("link_checking")}</span>}
      {status === "valid" && <span className="grid-card-status status-valid" title={t("link_valid")}>✓</span>}
      {status === "broken" && <span className="grid-card-status status-broken" title={t("link_broken")}>✗</span>}
    </div>
  );
}
