/**
 * Storage adapters — local filesystem and Vercel Blob
 */

export {
  uploadToLocalFs,
  deleteFromLocalFs,
  listLocalFiles,
  readLocalFile,
  localFileExists,
  type LocalUploadResult,
  type LocalFileMeta,
} from "./local-fs";

export {
  uploadToVercelBlob,
  deleteFromVercelBlob,
  listVercelBlobs,
  beginMultipartUpload,
  uploadBlobPart,
  finishMultipartUpload,
  type BlobUploadResult,
  type BlobListResult,
  type MultipartUploadSession,
} from "./vercel-blob";
