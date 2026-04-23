"use client";

import { InsightAttachedList } from "./insight-attached-list";

interface InsightNotesAndFilesViewProps {
  insightId: string;
  onContentChange?: () => void;
  onBack?: () => void;
  onClose?: () => void;
  /** External refresh trigger (e.g., parent increment after footer addition, triggers list refetch) */
  refreshKey?: number;
  /** Show only notes, not files */
  showNotesOnly?: boolean;
}

/**
 * Insight attachment view: mixed notes and files display, sorted by time, no add/upload buttons in tab
 */
export function InsightNotesAndFilesView({
  insightId,
  onContentChange,
  refreshKey = 0,
  showNotesOnly = false,
}: InsightNotesAndFilesViewProps) {
  return (
    <InsightAttachedList
      insightId={insightId}
      onContentChange={onContentChange}
      refreshKey={refreshKey}
      showNotesOnly={showNotesOnly}
    />
  );
}

// Dialog version (for standalone dialogs used elsewhere)
interface InsightNotesAndFilesDialogProps {
  onClose: () => void;
  insightId: string;
  onContentChange?: () => void;
}

export function InsightNotesAndFilesDialog({
  onClose,
  insightId,
  onContentChange,
}: InsightNotesAndFilesDialogProps) {
  const handleContentChange = () => {
    onContentChange?.();
  };

  return (
    <InsightNotesAndFilesView
      insightId={insightId}
      onContentChange={handleContentChange}
      onBack={onClose}
      onClose={onClose}
    />
  );
}
