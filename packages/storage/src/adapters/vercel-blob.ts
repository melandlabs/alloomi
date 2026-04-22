/**
 * Vercel Blob storage adapter
 * Used for server deployment
 */

import { del, put, list } from "@vercel/blob";
export type { Part } from "@vercel/blob";

const VERCEL_BLOB_API_BASE =
  process.env.VERCEL_BLOB_API_URL || "https://blob.vercel-storage.com";

function getBlobToken(): string {
  return process.env.BLOB_READ_WRITE_TOKEN || "";
}

async function blobApi(
  pathname: string,
  init: RequestInit & { queryParams?: Record<string, string> },
): Promise<Response> {
  const token = getBlobToken();
  const params = new URLSearchParams(init.queryParams || {}).toString();
  const url = `${VERCEL_BLOB_API_BASE}${pathname}${params ? `?${params}` : ""}`;

  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "x-api-version": "11",
    ...(init.headers as Record<string, string>),
  };

  return fetch(url, {
    ...init,
    headers,
  });
}

export type BlobUploadResult = {
  url: string;
  pathname: string;
  downloadUrl?: string;
};

export type BlobListResult = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: Date;
};

/**
 * Upload file to Vercel Blob
 */
export async function uploadToVercelBlob(
  pathname: string,
  data: ArrayBuffer | Buffer,
  contentType: string,
): Promise<BlobUploadResult> {
  const result = await put(pathname, data, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });

  return {
    url: result.url,
    pathname: result.pathname,
    downloadUrl: result.downloadUrl,
  };
}

/**
 * Delete file from Vercel Blob
 */
export async function deleteFromVercelBlob(url: string): Promise<void> {
  await del(url);
}

/**
 * List files in Vercel Blob
 */
export async function listVercelBlobs(
  prefix?: string,
): Promise<BlobListResult[]> {
  const result = await list({ prefix });

  return result.blobs.map((blob) => ({
    url: blob.url,
    pathname: blob.pathname,
    size: blob.size,
    uploadedAt: blob.uploadedAt,
  }));
}

export interface MultipartUploadSession {
  key: string;
  uploadId: string;
}

/**
 * Begin a multipart upload to Vercel Blob.
 * Returns the key and uploadId which are stored in Redis.
 */
export async function beginMultipartUpload(
  pathname: string,
  contentType: string,
): Promise<MultipartUploadSession> {
  const resp = await blobApi("/mpu", {
    queryParams: { pathname },
    method: "POST",
    headers: {
      "x-mpu-action": "create",
      "x-content-type": contentType,
    },
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(
      `[Blob MPU] create failed: status=${resp.status} body=${err} pathname=${pathname}`,
    );
    throw new Error(`Failed to create multipart upload: ${resp.status} ${err}`);
  }

  const data = (await resp.json()) as { key: string; uploadId: string };
  return { key: data.key, uploadId: data.uploadId };
}

/**
 * Upload a single part of a multipart upload.
 * Returns the etag needed to complete the upload.
 */
export async function uploadBlobPart(
  key: string,
  uploadId: string,
  partNumber: number,
  body: ArrayBuffer | Buffer,
  contentType: string,
): Promise<{ etag: string; partNumber: number }> {
  const resp = await blobApi("/mpu", {
    queryParams: { pathname: key },
    method: "POST",
    headers: {
      "x-mpu-action": "upload",
      "x-mpu-key": encodeURIComponent(key),
      "x-mpu-upload-id": uploadId,
      "x-mpu-part-number": String(partNumber),
      "x-content-type": contentType,
    },
    body: body instanceof ArrayBuffer ? body : Buffer.from(body as Buffer),
  });

  if (!resp.ok) {
    const err = await resp.text();
    console.error(
      `[Blob MPU] uploadPart failed: status=${resp.status} body=${err} key=${key} uploadId=${uploadId} partNumber=${partNumber}`,
    );
    throw new Error(`Failed to upload part: ${resp.status} ${err}`);
  }

  // requestApi returns apiResponse.json(), so etag is in the body
  const respBody = (await resp.json()) as { etag: string };
  return { etag: respBody.etag, partNumber };
}

/**
 * Complete a multipart upload and return the blob URL.
 */
export async function finishMultipartUpload(
  key: string,
  parts: { etag: string; partNumber: number }[],
  contentType: string,
  uploadId: string,
): Promise<BlobUploadResult> {
  const resp = await blobApi("/mpu", {
    queryParams: { pathname: key },
    method: "POST",
    headers: {
      "x-mpu-action": "complete",
      "x-mpu-key": encodeURIComponent(key),
      "x-mpu-upload-id": uploadId,
    },
    body: JSON.stringify(parts),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(
      `Failed to complete multipart upload: ${resp.status} ${err}`,
    );
  }

  const data = (await resp.json()) as {
    url: string;
    pathname: string;
    downloadUrl?: string;
  };
  return {
    url: data.url,
    pathname: data.pathname,
    downloadUrl: data.downloadUrl,
  };
}
