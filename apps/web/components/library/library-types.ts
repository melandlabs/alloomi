import type { KnowledgeFile } from "@/hooks/use-knowledge-files";

/**
 * Grid card layout for library mode:
 * - `library`: 16:9 snapshot on top (non-scrollable), bottom bar shows title and actions.
 * - `inline`: Top bar shows title and actions, large scrollable inline preview below (character page, etc.).
 */
export type LibraryGridCardVariant = "library" | "inline";

/** Tool execution item (library list metadata) */
export interface ToolExecution {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "error";
  timestamp: Date;
}

/** Unified item kind within library */
export type LibraryItemKind = "workspace_file" | "knowledge_file" | "tool";

/** Unified item type within library */
export interface LibraryItem {
  id: string;
  kind: LibraryItemKind;
  title: string;
  subtitle?: string;
  date: Date;
  groupKey: string;
  workspaceFile?: { taskId: string; path: string; name: string; type?: string };
  toolExecution?: ToolExecution;
  knowledgeFile?: KnowledgeFile;
}
