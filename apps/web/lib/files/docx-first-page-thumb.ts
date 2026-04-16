/**
 * Render DOCX first page content as PNG data URL using Mammoth for text extraction
 * and Canvas API for rendering.
 */
export async function renderDocxFirstPageToPngDataUrl(
  arrayBuffer: ArrayBuffer,
  scale = 0.42,
): Promise<string> {
  const mammothMod = await import("mammoth");
  const mammothLib = mammothMod.default ?? mammothMod;

  // Convert to plain text (no images)
  const result = await mammothLib.extractRawText({ arrayBuffer });
  const text = result.value ?? "";

  // Get first ~500 characters for preview
  const previewText = text.slice(0, 500).trim();

  // A4-like dimensions at 96 DPI: 794 x 1123 pixels, scaled
  const canvasWidth = Math.round(794 * scale);
  const canvasHeight = Math.round(1123 * scale);

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas 2D context");
  }

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Render text
  const fontSize = Math.round(12 * scale);
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `${fontSize}px "Segoe UI", "SF Pro Display", -apple-system, sans-serif`;
  ctx.textBaseline = "top";

  // Word wrap
  const lineHeight = Math.round(fontSize * 1.4);
  const padding = Math.round(16 * scale);
  const maxWidth = canvasWidth - padding * 2;
  const words = previewText.split(/\s+/);
  let line = "";
  let y = padding;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, padding, y);
      line = word;
      y += lineHeight;
      if (y > canvasHeight - padding) break;
    } else {
      line = testLine;
    }
  }
  if (line && y <= canvasHeight - padding) {
    ctx.fillText(line, padding, y);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to encode DOCX thumbnail"));
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
