import { deleteFile } from "@/lib/storage";

type AttachmentTelemetryBase = {
  source: string;
  userId: string;
};

export type AttachmentIngestTelemetry = AttachmentTelemetryBase & {
  blobPath: string;
  sizeBytes: number;
  contentType: string;
};

export type AttachmentIngestFailureTelemetry = AttachmentTelemetryBase & {
  reason: string;
};

export function recordAttachmentIngestFailure(
  event: AttachmentIngestFailureTelemetry,
) {
  console.warn("[AttachmentMonitor] ingestion failed", {
    source: event.source,
    userId: event.userId,
    reason: event.reason,
  });
}

export async function cleanupBlob(
  blobPath: string,
  reason: string,
): Promise<boolean> {
  try {
    // Use unified storage adapter (automatically selects Vercel Blob or local file system)
    await deleteFile(/* url */ "", blobPath);
    console.info("[AttachmentMonitor] cleaned blob", { blobPath, reason });
    return true;
  } catch (error) {
    console.error("[AttachmentMonitor] failed to clean blob", {
      blobPath,
      reason,
      error,
    });
    return false;
  }
}
