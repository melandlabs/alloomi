"use client";

import {
  WebsitePreviewDrawer,
  FilePreviewPanel,
} from "@/components/agent/dynamic-panels";
import { FilePreviewDrawerShell } from "@/components/file-preview-drawer-shell";

export interface FilePreviewData {
  path: string;
  name: string;
  type: string;
  taskId?: string;
}

/**
 * Full-screen mask + right-side file preview; mounted to body via {@link FilePreviewDrawerShell} to avoid being clipped by main content area.
 */
export function FilePreviewOverlay({
  file,
  onClose,
}: {
  file: FilePreviewData;
  onClose: () => void;
}) {
  return (
    <FilePreviewDrawerShell
      onClose={onClose}
      drawerClassName="sm:w-[min(100vw,40rem)] md:w-[min(100vw,50rem)] lg:w-[min(100vw,56.25rem)]"
    >
      {file.type === "html" || file.type === "htm" ? (
        <WebsitePreviewDrawer
          file={file}
          taskId={file.taskId}
          onClose={onClose}
        />
      ) : (
        <FilePreviewPanel file={file} taskId={file.taskId} onClose={onClose} />
      )}
    </FilePreviewDrawerShell>
  );
}
