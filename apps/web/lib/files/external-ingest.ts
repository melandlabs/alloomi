import { randomUUID } from "node:crypto";
import {
  SUPPORTED_ATTACHMENT_MIME_TYPES,
  type SupportedAttachmentMediaType,
} from "@/lib/files/config";
import {
  ensureExtension,
  getExtensionFromContentType,
  sanitizeFilename,
} from "@/lib/files/utils";
import { uploadFile } from "@/lib/storage";

const DEFAULT_MAX_EXTERNAL_ATTACHMENT_BYTES = 100 * 1024 * 1024; // 100MB

export type AttachmentDownloadPayload = {
  data: ArrayBuffer | Buffer;
  contentType?: string | null;
  sizeBytes?: number | null;
};

export type ExternalAttachmentIngestOptions = {
  source: string;
  userId: string;
  downloadAttachment: () => Promise<AttachmentDownloadPayload>;
  originalFileName?: string | null;
  mimeTypeHint?: string | null;
  sizeHintBytes?: number | null;
  maxSizeBytes?: number;
};

export type IngestedAttachment = {
  url: string;
  downloadUrl: string;
  blobPath: string;
  contentType: SupportedAttachmentMediaType;
  sizeBytes: number;
  fileName: string;
};

export type ExternalAttachmentIngestResult =
  | { success: true; attachment: IngestedAttachment }
  | { success: false; reason: IngestExternalAttachmentFailure };

export type IngestExternalAttachmentFailure =
  | "insufficient_quota"
  | "deduction_failed"
  | "unsupported_media_type"
  | "size_exceeded"
  | "fetch_failed";

export async function ingestExternalAttachment(
  options: ExternalAttachmentIngestOptions,
): Promise<ExternalAttachmentIngestResult> {
  const {
    userId,
    downloadAttachment,
    originalFileName,
    mimeTypeHint,
    sizeHintBytes,
    maxSizeBytes = DEFAULT_MAX_EXTERNAL_ATTACHMENT_BYTES,
  } = options;

  try {
    const payload = await downloadAttachment();
    const declaredSize = payload.sizeBytes ?? sizeHintBytes ?? null;

    if (
      declaredSize !== null &&
      Number.isFinite(declaredSize) &&
      declaredSize > maxSizeBytes
    ) {
      return { success: false, reason: "size_exceeded" };
    }

    const buffer = Buffer.isBuffer(payload.data)
      ? payload.data
      : Buffer.from(payload.data);

    if (buffer.length > maxSizeBytes) {
      return { success: false, reason: "size_exceeded" };
    }

    const resolvedMime =
      mimeTypeHint ?? payload.contentType ?? "application/octet-stream";

    if (
      !SUPPORTED_ATTACHMENT_MIME_TYPES.includes(
        resolvedMime as SupportedAttachmentMediaType,
      )
    ) {
      return { success: false, reason: "unsupported_media_type" };
    }

    const extension = getExtensionFromContentType(resolvedMime);
    const sanitizedName = sanitizeFilename(
      originalFileName ?? `attachment-${Date.now()}`,
    );
    const finalFilename = ensureExtension(sanitizedName, extension);
    const pathname = `${userId}/${Date.now()}-${randomUUID()}-${finalFilename}`;

    // Use unified storage adapter (automatically selects Vercel Blob or local file system)
    const uploadResult = await uploadFile(
      pathname,
      buffer,
      resolvedMime as SupportedAttachmentMediaType,
    );

    return {
      success: true,
      attachment: {
        url: uploadResult.url,
        downloadUrl: uploadResult.downloadUrl ?? uploadResult.url,
        blobPath: uploadResult.pathname,
        contentType: resolvedMime as SupportedAttachmentMediaType,
        sizeBytes: buffer.length,
        fileName: finalFilename,
      },
    };
  } catch (error) {
    console.error("[attachment] external ingestion failed", error);
    return { success: false, reason: "fetch_failed" };
  }
}
