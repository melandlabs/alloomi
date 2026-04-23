"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useKnowledgeFiles } from "@/hooks/use-knowledge-files";

/**
 * Files panel context value type
 */
interface FilesPanelContextValue {
  files: ReturnType<typeof useKnowledgeFiles>;
}

const FilesPanelContext = createContext<FilesPanelContextValue | undefined>(
  undefined,
);

/**
 * Files panel Provider component
 * Manages useKnowledgeFiles hook state, shared by child components
 */
export function FilesPanelProvider({ children }: { children: ReactNode }) {
  const files = useKnowledgeFiles();

  return (
    <FilesPanelContext.Provider value={{ files }}>
      {children}
    </FilesPanelContext.Provider>
  );
}

/**
 * Hook using files panel Context
 */
export function useFilesPanelContext() {
  const context = useContext(FilesPanelContext);
  if (!context) {
    throw new Error(
      "useFilesPanelContext must be used within a FilesPanelProvider",
    );
  }
  return context.files;
}
