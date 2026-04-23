"use client";

import { useState, useRef, useEffect, useMemo, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { RemixIcon } from "@/components/remix-icon";
import { toast } from "sonner";
import { openUrl, openPathCustom, revealItemInDir, isTauri } from "@/lib/tauri";
import { inlineResources } from "@/lib/files/inline-resources";
import { FilePreviewDrawerHeader } from "@/components/file-preview-drawer-header";
import { FilePreviewDrawerRichTextToolbar } from "@/components/file-preview-drawer-rich-text-toolbar";
import { useTranslation } from "react-i18next";
import { injectHtmlPreviewScrollFix } from "@/lib/files/html-preview-scroll-fix";

// Bundle optimization: Dynamically import CodePreview
const CodePreview = lazy(() =>
  import("./artifacts/code-preview").then((mod) => ({
    default: mod.CodePreview,
  })),
);

export interface WebsitePreviewProps {
  content: string;
  filename?: string;
  filePath?: string;
  onClose?: () => void;
  className?: string;
}

/**
 * Embedded HTML preview: toolbar aligns with library list grid card header (icon slot + title layout).
 */
export function WebsitePreview({
  content,
  filename = "index.html",
  filePath,
  onClose,
  className,
}: WebsitePreviewProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [inlineContent, setInlineContent] = useState<string>(content);
  const [isInlining, setIsInlining] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Inline CSS and JS resources when content or filePath changes
  useEffect(() => {
    const processContent = async () => {
      // If content has no external resources (no <link> or <script src>), use as-is
      const hasExternalCss = /<link\s+[^>]*href=["'][^"']+["'][^>]*>/i.test(
        content,
      );
      const hasExternalJs =
        /<script\s+src=["'][^"']+["'][^>]*><\/script>/i.test(content);

      if ((!hasExternalCss && !hasExternalJs) || !filePath) {
        setInlineContent(content);
        return;
      }

      setIsInlining(true);
      try {
        let fileDir = "";
        let taskId = "";

        // Extract fileDir from filePath
        const lastSlashIndex = filePath.lastIndexOf("/");
        fileDir = filePath.substring(0, lastSlashIndex);

        // Extract taskId from path if available
        const sessionMatch = filePath.match(/\/\.alloomi\/sessions\/([^\/]+)/);
        if (sessionMatch) {
          taskId = sessionMatch[1];
        }

        const processed = await inlineResources(content, fileDir, taskId);
        setInlineContent(processed);
      } catch (error) {
        console.error("[WebsitePreview] Failed to inline resources:", error);
        setInlineContent(content);
      } finally {
        setIsInlining(false);
      }
    };

    processContent();
  }, [content, filePath]);

  /** iframe-specific: inject single-scroll root styles to prevent multiple vertical scrollbars in preview document html/body vs inner container */
  const previewSrcDoc = useMemo(
    () => injectHtmlPreviewScrollFix(inlineContent),
    [inlineContent],
  );

  const openExternalTooltip = useMemo(() => {
    if (isTauri() && filePath) {
      return t(
        "common.filePreview.openWithDefaultApp",
        "Open with Default App",
      );
    }
    return t("common.filePreview.openInNewTab", "Open in New Tab");
  }, [filePath, t]);

  // Use srcdoc instead of blob URL to avoid CSP restrictions in dev mode
  // (Vite dev server CSP blocks blob: in frame-src)
  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inlineContent);
      setCopied(true);
      toast.success("HTML copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy HTML");
    }
  };

  // Handle open in new tab
  const handleOpenExternal = async () => {
    try {
      // In Tauri environment with local file path, open local file with system command
      if (isTauri() && filePath) {
        const success = await openPathCustom(filePath);
        if (!success) {
          toast.error("Failed to open file");
        }
        return;
      }

      // In browser environment or without local path, use blob URL
      const blob = new Blob([inlineContent], { type: "text/html" });
      const blobUrl = URL.createObjectURL(blob);

      await openUrl(blobUrl);
    } catch (error) {
      console.error("Failed to open external:", error);
      toast.error("Failed to open in new tab");
    }
  };

  // Handle refresh iframe
  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  // Handle show in folder
  const handleShowInFolder = async () => {
    if (!filePath) return;
    try {
      await revealItemInDir(filePath);
    } catch (error) {
      console.error("Failed to show in folder:", error);
      toast.error("Failed to show in folder");
    }
  };

  return (
    <div
      className={cn(
        "bg-background flex h-full min-h-0 flex-col z-[1000]",
        className,
      )}
    >
      <FilePreviewDrawerHeader fileName={filename}>
        <FilePreviewDrawerRichTextToolbar
          format="html"
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          filePath={filePath}
          onClose={onClose}
          copied={copied}
          onCopy={handleCopy}
          onRefreshPreview={handleRefresh}
          onRevealInFolder={
            filePath ? () => void handleShowInFolder() : undefined
          }
          showOpenExternal
          onOpenExternal={() => void handleOpenExternal()}
          openExternalTooltip={openExternalTooltip}
        />
      </FilePreviewDrawerHeader>

      {/* Content: min-h-0 allows flex children to shrink, avoiding duplicate scrollbars in outer and iframe */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {viewMode === "preview" ? (
          isInlining ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <RemixIcon
                  name="loader_2"
                  size="size-5"
                  className="animate-spin text-muted-foreground"
                />
                <p className="text-muted-foreground text-sm">
                  Inlining resources...
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-0 overflow-hidden bg-white">
              <iframe
                key={iframeKey}
                ref={iframeRef}
                srcDoc={previewSrcDoc}
                className="block size-full min-h-0 border-0"
                title={filename}
                sandbox="allow-same-origin allow-popups"
              />
            </div>
          )
        ) : (
          <div className="bg-muted/30 h-full min-h-0 overflow-auto p-4">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-full">
                  <RemixIcon
                    name="loader_2"
                    size="size-5"
                    className="animate-spin"
                  />
                </div>
              }
            >
              <CodePreview
                code={inlineContent}
                filename={filename}
                language="html"
                maxHeight="100%"
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
