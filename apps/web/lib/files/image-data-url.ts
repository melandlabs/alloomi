const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

/**
 * Convert binary image data to a base64 data URL.
 * Uses Blob/FileReader to safely handle any byte values (including >= 128).
 */
export async function bytesToImageDataUrl(
  bytes: Uint8Array,
  ext: string,
): Promise<string> {
  const mime = MIME_TYPES[ext.toLowerCase()] ?? "image/png";

  // SVG is text/XML, handle it specially
  if (ext.toLowerCase() === "svg") {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const base64 = btoa(unescape(encodeURIComponent(text)));
    return `data:${mime};base64,${base64}`;
  }

  // For binary images, use Blob/FileReader to avoid btoa issues with high byte values
  const blob = new Blob([bytes as unknown as BlobPart], { type: mime });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const r = reader.result;
      if (typeof r === "string") resolve(r);
      else reject(new Error("Unexpected read result"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}
