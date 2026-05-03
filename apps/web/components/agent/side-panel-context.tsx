"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Display mode for the side panel */
export type DisplayMode = "sidebar" | "fullscreen";

/** Side panel description */
export interface SidePanel {
  /** Panel unique identifier */
  id: string;
  /** Panel content (complete ReactNode including header + body) */
  content: ReactNode;
  /** Panel width in pixels, uses default width if not provided */
  width?: number;
  /** Display mode: sidebar (default) or fullscreen */
  displayMode?: DisplayMode;
  /** Custom close callback (overrides default behavior) */
  onClose?: () => void;
}

interface SidePanelContextValue {
  /** Currently open sidebar panel, null means closed */
  sidePanel: SidePanel | null;
  /** Open sidebar panel (only one kept at a time) */
  openSidePanel: (panel: SidePanel) => void;
  /** Close sidebar panel */
  closeSidePanel: () => void;
  /** Update panel width (for drag resize) */
  setSidePanelWidth: (width: number) => void;
  /** Update panel content (for passing latest props) */
  setSidePanelContent: (content: ReactNode) => void;
  /** Set panel display mode (sidebar or fullscreen) */
  setSidePanelDisplayMode: (mode: DisplayMode) => void;
}

const SidePanelContext = createContext<SidePanelContextValue | null>(null);

/** Default value when not wrapped in SidePanelProvider (noop) */
const defaultSidePanelValue: SidePanelContextValue = {
  sidePanel: null,
  openSidePanel: () => {},
  closeSidePanel: () => {},
  setSidePanelWidth: () => {},
  setSidePanelContent: () => {},
  setSidePanelDisplayMode: () => {},
};

/** LocalStorage key for persisting side panel width */
const SIDE_PANEL_WIDTH_KEY = "sidePanelWidth";

/**
 * Generate current "page" identifier: pathname + key search (page), for detecting page navigation
 */
function getRouteKey(
  pathname: string,
  searchParams: URLSearchParams | null,
): string {
  const page = searchParams?.get("page") ?? "";
  return `${pathname}${page ? `?page=${page}` : ""}`;
}

/**
 * Global temporary sidebar context provider
 * - Any page can call openSidePanel to open right sidebar
 * - Auto-closes on page change (pathname or page param change, no persistence)
 */
export function SidePanelProvider({ children }: { children: ReactNode }) {
  const [sidePanel, setSidePanel] = useState<SidePanel | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = getRouteKey(pathname, searchParams);
  const prevRouteKey = useRef(routeKey);

  // Auto-close sidebar on page change (pathname or page, etc.)
  useEffect(() => {
    if (prevRouteKey.current !== routeKey) {
      prevRouteKey.current = routeKey;
      setSidePanel(null);
    }
  }, [routeKey]);

  /** Open sidebar, only one panel shown at a time */
  const openSidePanel = useCallback((panel: SidePanel) => {
    let nextPanel = panel;
    // If panel doesn't specify width, try to restore from localStorage
    if (nextPanel.width === undefined) {
      try {
        const savedWidth = localStorage.getItem(SIDE_PANEL_WIDTH_KEY);
        if (savedWidth) {
          const parsed = Number.parseInt(savedWidth, 10);
          if (!Number.isNaN(parsed) && parsed > 0) {
            nextPanel = { ...nextPanel, width: parsed };
          }
        }
      } catch {
        // Ignore localStorage errors
      }
    }
    setSidePanel(nextPanel);
  }, []);

  /** Close sidebar */
  const closeSidePanel = useCallback(() => {
    setSidePanel(null);
  }, []);

  /** Update panel width (for drag resize, doesn't rebuild content) */
  const setSidePanelWidth = useCallback((width: number) => {
    setSidePanel((prev) => (prev ? { ...prev, width } : prev));
    // Persist width to localStorage
    try {
      localStorage.setItem(SIDE_PANEL_WIDTH_KEY, String(width));
    } catch {
      // Ignore localStorage errors (quota exceeded, private browsing, etc.)
    }
  }, []);

  /** Update panel content */
  const setSidePanelContent = useCallback((content: ReactNode) => {
    setSidePanel((prev) => (prev ? { ...prev, content } : prev));
  }, []);

  /** Set panel display mode */
  const setSidePanelDisplayMode = useCallback((mode: DisplayMode) => {
    setSidePanel((prev) => (prev ? { ...prev, displayMode: mode } : prev));
  }, []);

  return (
    <SidePanelContext.Provider
      value={{
        sidePanel,
        openSidePanel,
        closeSidePanel,
        setSidePanelWidth,
        setSidePanelContent,
        setSidePanelDisplayMode,
      }}
    >
      {children}
    </SidePanelContext.Provider>
  );
}

/**
 * Use sidebar in any client component
 * Returns noop default if not wrapped in SidePanelProvider
 */
export function useSidePanel(): SidePanelContextValue {
  const ctx = useContext(SidePanelContext);
  return ctx ?? defaultSidePanelValue;
}
