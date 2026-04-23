"use client";

import { useFilesPanelContext } from "./files-panel-context";
import { FilesPanelHeader } from "./files-panel-header";
import { FilesPanel } from "./files-panel";
import type { ReactNode } from "react";

/**
 * Files panel Header component (using Context)
 * Note: This component must be used within FilesPanelProvider
 */
export function FilesPanelHeaderWrapper({
  children,
}: {
  children?: ReactNode;
}) {
  const { isLoading, isUploading, uploadProgress, fetchFiles, uploadFile } =
    useFilesPanelContext();

  return (
    <FilesPanelHeader
      isLoading={isLoading}
      isUploading={isUploading}
      uploadProgress={uploadProgress || undefined}
      onRefresh={fetchFiles}
      onUpload={uploadFile}
    >
      {children}
    </FilesPanelHeader>
  );
}

/**
 * Files panel Content component (using Context)
 * Note: This component must be used within FilesPanelProvider
 */
export function FilesPanelContentWrapper() {
  return <FilesPanel />;
}
