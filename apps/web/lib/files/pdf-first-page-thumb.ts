/**
 * Render the first page of a PDF to PNG data URL using pdf.js,
 * for use as 16:9 thumbnails in the library grid.
 */
export async function renderPdfFirstPageToPngDataUrl(
  data: Uint8Array,
  /** Rendering scale; smaller value means smaller file, suitable for card thumbnails */
  scale = 0.42,
): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }

  const doc = await pdfjsLib.getDocument({ data: data.slice() }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas 2D context");
  }
  await page.render({ canvasContext: ctx, viewport } as any).promise;
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to encode PDF thumbnail"));
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          const r = reader.result;
          if (typeof r === "string") resolve(r);
          else reject(new Error("Unexpected read result"));
        };
        reader.onerror = () => reject(reader.error ?? new Error("read failed"));
        reader.readAsDataURL(blob);
      },
      "image/png",
      0.85,
    );
  });
}
