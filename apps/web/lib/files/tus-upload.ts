/**
 * TUS-style chunked upload for images
 * Used for large images that exceed Vercel's 4.5MB request body limit
 */
import { getAuthToken } from "@/lib/auth/token-manager";
import { getCloudUrl } from "@/lib/auth/cloud-proxy";

const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB - stays under Vercel's 4.5MB body limit

// Unified threshold: files larger than this use TUS chunked upload.
// 400KB stays well under Vercel's 4.5MB body limit and protects small images too.
export const TUS_SIZE_THRESHOLD = 400 * 1024;

export function isImageFile(mediaType?: string): boolean {
  return mediaType?.startsWith("image/") ?? false;
}

/**
 * Upload an image file using TUS-style chunked upload
 * Returns the blob URL that can be used to retrieve the uploaded file
 */
export async function uploadImageTUS(
  file: File,
  maxRetries = 3,
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 1. Create upload session
      const headers: HeadersInit = {
        "Upload-Length": String(file.size),
      };

      const cloudToken = getAuthToken();
      if (cloudToken) {
        headers.Authorization = `Bearer ${cloudToken}`;
      }

      const createRes = await fetch("/api/ai/v1/upload", {
        method: "POST",
        credentials: "include",
        headers,
      });
      if (!createRes.ok) {
        const errorBody = await createRes.text();
        console.error(
          "[TUS] Failed to create upload session:",
          createRes.status,
          errorBody,
        );
        if (attempt < maxRetries) continue;
        return null;
      }

      const location = createRes.headers.get("Location");
      if (!location) {
        console.error("[TUS] No Location header in upload session response");
        console.log(
          "[TUS] Response headers:",
          Array.from(createRes.headers.entries()),
        );
        if (attempt < maxRetries) continue;
        return null;
      }

      const uploadId = location.split("uploadId=")[1];
      if (!uploadId) {
        console.error(
          "[TUS] Could not extract uploadId from Location:",
          location,
        );
        if (attempt < maxRetries) continue;
        return null;
      }
      console.log(
        `[TUS] Created upload session: ${uploadId} (attempt ${attempt}/${maxRetries})`,
      );

      // 2. Upload chunks
      let offset = 0;
      let chunkFailed = false;
      let chunkIndex = 0;
      while (offset < file.size) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        const chunkBuffer = await chunk.arrayBuffer();

        const chunkHeaders: HeadersInit = {
          "Upload-Offset": String(offset),
          "Content-Length": String(chunkBuffer.byteLength),
          "Content-Type": "application/offset+octet-stream",
        };

        const chunkToken = getAuthToken();
        if (chunkToken) {
          chunkHeaders.Authorization = `Bearer ${chunkToken}`;
        }

        const patchRes = await fetch(`/api/ai/v1/upload?uploadId=${uploadId}`, {
          method: "PATCH",
          credentials: "include",
          headers: chunkHeaders,
          body: chunkBuffer,
        });

        if (!patchRes.ok) {
          const errorBody = await patchRes.text();
          console.error(
            `[TUS] Chunk ${chunkIndex} upload failed: ${patchRes.status}, offset: ${offset}`,
            errorBody,
          );
          chunkFailed = true;
          break;
        }

        offset += chunkBuffer.byteLength;
        chunkIndex++;
      }

      if (chunkFailed) {
        if (attempt < maxRetries) continue;
        return null;
      }

      console.log(`[TUS] All chunks uploaded successfully: ${uploadId}`);

      // 3. Return cloud blob URL so OpenRouter can fetch it
      const cloudUrl = getCloudUrl();
      return `${cloudUrl}/api/ai/v1/upload?uploadId=${uploadId}`;
    } catch (err) {
      console.error(
        `[TUS] Upload error (attempt ${attempt}/${maxRetries}):`,
        err,
      );
      if (attempt < maxRetries) continue;
      return null;
    }
  }
  return null;
}
