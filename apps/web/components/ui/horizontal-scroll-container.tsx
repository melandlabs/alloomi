"use client";

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface HorizontalScrollContainerProps {
  /**
   * Child element content
   */
  children: ReactNode;
  /**
   * Custom className
   */
  className?: string;
  /**
   * Whether to auto-scroll to the right (when content is updated)
   * @default false
   */
  autoScrollToEnd?: boolean;
  /**
   * Dependency array for auto-scroll (similar to useEffect dependencies)
   * When these values change, auto-scroll will be triggered
   */
  autoScrollDeps?: unknown[];
  /**
   * Whether to show scrollbar (shown on hover)
   * @default false
   */
  showScrollbar?: boolean;
  /**
   * Whether to disable drag functionality
   * @default false
   */
  disableDrag?: boolean;
  /**
   * Scroll container ref (for external access)
   */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

/**
 * Horizontal scroll container component
 *
 * Abstracts the history conversation scroll interaction logic in chat-header-panel, supports:
 * - Mouse drag scrolling
 * - Touch drag scrolling
 * - Touchpad gesture scrolling (wheel event)
 * - Optional auto-scroll to the right
 * - Prevent click events during dragging
 *
 * Use cases:
 * - History conversation scroll in Chat panel header
 * - Sub-tabs scroll in Insight panel header
 */
export function HorizontalScrollContainer({
  children,
  className,
  autoScrollToEnd = false,
  autoScrollDeps = [],
  showScrollbar = false,
  disableDrag = false,
  scrollRef: externalScrollRef,
}: HorizontalScrollContainerProps) {
  const internalScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = externalScrollRef || internalScrollRef;

  // Drag-related state
  const [isDragging, setIsDragging] = useState(false);
  const [isTrackpadScrolling, setIsTrackpadScrolling] = useState(false);
  const dragStartRef = useRef<{ x: number; scrollLeft: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const shouldAutoScrollRef = useRef(true); // Control whether auto-scroll should occur
  const isUserInteractingRef = useRef(false); // Flag whether user is interacting (dragging or manual scrolling)
  const rafIdRef = useRef<number | null>(null); // requestAnimationFrame ID
  const [isHovered, setIsHovered] = useState(false);

  /**
   * Handle mouse drag start
   */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disableDrag) return;

      const container = scrollRef.current;
      if (!container) return;

      // Only start dragging on left mouse button press
      if (e.button !== 0) return;

      setIsDragging(true);
      hasDraggedRef.current = false; // Reset drag flag
      shouldAutoScrollRef.current = false; // User started dragging, disable auto-scroll
      isUserInteractingRef.current = true; // Flag user is interacting
      dragStartRef.current = {
        x: e.clientX,
        scrollLeft: container.scrollLeft,
      };

      // Prevent text selection
      e.preventDefault();
    },
    [disableDrag, scrollRef],
  );

  /**
   * Handle mouse move (while dragging)
   * Uses requestAnimationFrame to optimize performance for smoother scrolling
   */
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragStartRef.current || disableDrag) return;

      const container = scrollRef.current;
      if (!container) return;

      const deltaX = e.clientX - dragStartRef.current.x;

      // If movement distance exceeds threshold, mark as dragged
      if (Math.abs(deltaX) > 3) {
        hasDraggedRef.current = true;
        shouldAutoScrollRef.current = false;
        isUserInteractingRef.current = true; // Flag user is interacting
      }

      // Cancel previous animation frame request
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      // Use requestAnimationFrame to optimize scroll updates
      rafIdRef.current = requestAnimationFrame(() => {
        if (!dragStartRef.current || !container) return;

        // Update scroll position
        const newScrollLeft = dragStartRef.current.scrollLeft - deltaX;
        // Ensure scroll position is within valid range
        const maxScroll = container.scrollWidth - container.clientWidth;
        const clampedScrollLeft = Math.max(
          0,
          Math.min(newScrollLeft, maxScroll),
        );
        container.scrollLeft = clampedScrollLeft;
        // Update dragStartRef for continuous dragging
        dragStartRef.current = {
          x: e.clientX,
          scrollLeft: clampedScrollLeft,
        };
      });
    },
    [isDragging, disableDrag, scrollRef],
  );

  /**
   * Handle mouse release (drag end)
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;

    // Cancel unfinished animation frame requests
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Delay reset of user interaction flag to ensure auto-scroll is not triggered immediately
    // Note: do not reset hasDraggedRef here, let onClick event check first
    setTimeout(() => {
      hasDraggedRef.current = false;
      // Delay reset of user interaction flag to give scroll position time to stabilize
      setTimeout(() => {
        isUserInteractingRef.current = false;
      }, 50);
    }, 100);
  }, []);

  /**
   * Handle mouse leave container (drag end)
   */
  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
    // Do not reset hasDraggedRef, let possible click event check first
  }, []);

  /**
   * Handle touch drag start
   */
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (disableDrag) return;

      const container = scrollRef.current;
      if (!container) return;

      const touch = e.touches[0];
      if (!touch) return;

      // Record start position, but do not set isDragging immediately
      // Only set isDragging when movement distance exceeds threshold
      hasDraggedRef.current = false; // Reset drag flag
      dragStartRef.current = {
        x: touch.clientX,
        scrollLeft: container.scrollLeft,
      };
    },
    [disableDrag, scrollRef],
  );

  /**
   * Handle touch move (while dragging)
   */
  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (disableDrag) return;

      const container = scrollRef.current;
      if (!container || !dragStartRef.current) return;

      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - dragStartRef.current.x;

      // If movement distance exceeds threshold, start dragging
      if (!isDragging && Math.abs(deltaX) > 5) {
        setIsDragging(true);
        hasDraggedRef.current = true;
        shouldAutoScrollRef.current = false;
      }

      // If dragging or movement distance exceeds threshold, update scroll position
      if (isDragging || Math.abs(deltaX) > 5) {
        hasDraggedRef.current = true;
        shouldAutoScrollRef.current = false;
        isUserInteractingRef.current = true; // Flag user is interacting
        // Prevent default scroll behavior
        e.preventDefault();
        e.stopPropagation();
        // Update scroll position
        const newScrollLeft = dragStartRef.current.scrollLeft - deltaX;
        // Ensure scroll position is within valid range
        const maxScroll = container.scrollWidth - container.clientWidth;
        const clampedScrollLeft = Math.max(
          0,
          Math.min(newScrollLeft, maxScroll),
        );
        container.scrollLeft = clampedScrollLeft;
        // Update dragStartRef for continuous dragging
        dragStartRef.current = {
          x: touch.clientX,
          scrollLeft: newScrollLeft,
        };
      }
    },
    [isDragging, disableDrag, scrollRef],
  );

  /**
   * Handle touch end (drag end)
   */
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
    // Delay reset of user interaction flag to ensure auto-scroll is not triggered immediately
    // Note: do not reset hasDraggedRef here, let onClick event check first
    setTimeout(() => {
      hasDraggedRef.current = false;
      // Delay reset of user interaction flag to give scroll position time to stabilize
      setTimeout(() => {
        isUserInteractingRef.current = false;
      }, 50);
    }, 100);
  }, []);

  /**
   * Add global mouse event listeners
   */
  useEffect(() => {
    if (isDragging && !disableDrag) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      // Prevent text selection during dragging
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
    } else {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [isDragging, disableDrag, handleMouseMove, handleMouseUp]);

  /**
   * Add touchpad gesture scroll support (wheel event)
   * Optimize touchpad interaction for smoother and more natural feel
   */
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || disableDrag) return;

    let wheelTimeoutId: NodeJS.Timeout | null = null;

    const handleWheelEvent = (e: WheelEvent) => {
      // Check for horizontal scroll (deltaX is not 0)
      // Or vertical scroll when holding Shift key (converted to horizontal scroll)
      const hasHorizontalScroll =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;

      if (hasHorizontalScroll) {
        // Flag that trackpad gesture is being used
        setIsTrackpadScrolling(true);
        // User is using trackpad gesture, disable auto-scroll
        shouldAutoScrollRef.current = false;
        isUserInteractingRef.current = true; // Flag user is interacting

        // Prevent default vertical scroll behavior
        e.preventDefault();
        e.stopPropagation();

        // Calculate scroll distance
        const scrollAmount = e.shiftKey ? e.deltaY : e.deltaX;

        // Use requestAnimationFrame to optimize scroll performance
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
        }

        rafIdRef.current = requestAnimationFrame(() => {
          // Execute horizontal scroll using native scroll for best performance
          container.scrollBy({
            left: scrollAmount,
            behavior: "auto", // Use auto for more natural scroll experience
          });
        });

        // Clear previous timeout
        if (wheelTimeoutId) {
          clearTimeout(wheelTimeoutId);
        }

        // Delay reset of user interaction flag and trackpad flag
        wheelTimeoutId = setTimeout(() => {
          isUserInteractingRef.current = false;
          setIsTrackpadScrolling(false);
        }, 150);
      }
    };

    // Use { passive: false } to allow preventDefault
    container.addEventListener("wheel", handleWheelEvent, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheelEvent);
      if (wheelTimeoutId) {
        clearTimeout(wheelTimeoutId);
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [disableDrag, scrollRef]);

  /**
   * Auto-scroll to the right
   * When content is updated, auto-scroll to the right to show latest content
   */
  useEffect(() => {
    if (!autoScrollToEnd) return;

    // When dependencies change, re-enable auto-scroll (but only if user is not interacting)
    if (!isUserInteractingRef.current) {
      shouldAutoScrollRef.current = true;
    }

    // Only execute if auto-scroll should happen and not in dragging state and user is not interacting
    if (
      shouldAutoScrollRef.current &&
      !isDragging &&
      !isUserInteractingRef.current
    ) {
      // Delay execution to ensure DOM has updated
      const timeoutId = setTimeout(() => {
        const container = scrollRef.current;
        if (!container) return;
        if (
          shouldAutoScrollRef.current &&
          !isDragging &&
          !isUserInteractingRef.current
        ) {
          // Scroll to the far right, show latest content
          const maxScroll = container.scrollWidth - container.clientWidth;
          if (maxScroll > 0) {
            container.scrollTo({
              left: maxScroll,
              behavior: "smooth",
            });
          }
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [autoScrollToEnd, isDragging, scrollRef, ...autoScrollDeps]);

  /**
   * Get drag state, used by child components to determine if dragging occurred
   * Child components can access this function via ref
   */
  const getHasDragged = useCallback(() => {
    return hasDraggedRef.current;
  }, []);

  /**
   * Reset drag state
   */
  const resetDragState = useCallback(() => {
    hasDraggedRef.current = false;
  }, []);

  // Mount getHasDragged and resetDragState to ref for child components to use
  useEffect(() => {
    (scrollRef.current as any).getHasDragged = getHasDragged;
    (scrollRef.current as any).resetDragState = resetDragState;
  }, [scrollRef, getHasDragged, resetDragState]);

  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label="Horizontal scrollable container"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        handleMouseLeave();
      }}
      className={cn(
        "flex items-center gap-2 min-w-0 flex-1",
        // Support horizontal scroll (including mouse wheel and dragging)
        "overflow-x-auto overflow-y-hidden",
        // Only use smooth scroll when not dragging and not trackpad scrolling, for better performance
        !isDragging && !isTrackpadScrolling && "scroll-smooth",
        // Prevent text selection during dragging
        "select-none",
        // Cursor style during dragging
        !disableDrag && (isDragging ? "cursor-grabbing" : "cursor-grab"),
        // Scrollbar style: hidden by default
        "[&::-webkit-scrollbar]:h-0",
        "[&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:bg-transparent",
        "[scrollbar-width:none]",
        // If showScrollbar is enabled, show on hover
        showScrollbar && [
          isHovered && "[&::-webkit-scrollbar]:h-1.5",
          isHovered && "[&::-webkit-scrollbar-thumb]:bg-border",
          isHovered &&
            "[&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/40",
          isHovered && "[scrollbar-width:thin]",
          isHovered && "[scrollbar-color:theme(colors.border)_transparent]",
        ],
        className,
      )}
      style={{
        touchAction: disableDrag ? "auto" : "pan-x", // Allow horizontal drag gesture
        WebkitOverflowScrolling: "touch", // iOS smooth scroll
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  );
}

/**
 * Helper function to check if dragging occurred
 * Used in child component onClick events to determine if click should be prevented
 *
 * @param containerRef - HorizontalScrollContainer ref
 * @returns Whether dragging occurred
 */
export function hasDragged(
  containerRef: React.RefObject<HTMLDivElement | null>,
): boolean {
  if (!containerRef.current) return false;
  const getHasDragged = (containerRef.current as any).getHasDragged;
  return getHasDragged ? getHasDragged() : false;
}
