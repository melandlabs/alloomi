/**
 * Render PPTX first slide as PNG data URL using JSZip for parsing
 * and Canvas API for rendering, for use as 16:9 thumbnails in the library grid.
 */
export async function renderPptxFirstPageToPngDataUrl(
  arrayBuffer: ArrayBuffer,
  scale = 0.42,
): Promise<string> {
  const JSZipModule = await import("jszip");

  /** JSZip module type (export = JSZip, with both constructor and static methods like loadAsync) */
  type JSZipType = import("jszip");
  const JSZip = ((JSZipModule as { default?: JSZipType }).default ??
    JSZipModule) as JSZipType;

  const zip = await JSZip.loadAsync(arrayBuffer, { checkCRC32: false });

  // PPTX standard slide size: 9144000 x 6858000 EMU (10 x 7.5 inches at 96 DPI)
  const slideWidthEmu = 9144000;
  const slideHeightEmu = 6858000;

  // Canvas dimensions at scale
  const canvasWidth = Math.round((slideWidthEmu / 914400) * 96 * scale);
  const canvasHeight = Math.round((slideHeightEmu / 914400) * 96 * scale);

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas 2D context");
  }

  // Helper: EMU to pixel at given scale
  const emuToPx = (emu: number) => (emu / slideWidthEmu) * canvasWidth;

  // Helper: EMU height to pixel at given scale
  const emuToPxH = (emu: number) => (emu / slideHeightEmu) * canvasHeight;

  // Load images from media folder
  const imageUrls = new Map<string, string>();
  const mediaFiles = Object.keys(zip.files).filter((name) =>
    name.startsWith("ppt/media/"),
  );
  for (const mediaPath of mediaFiles) {
    const file = zip.files[mediaPath];
    if (!file.dir) {
      const blob = await file.async("blob");
      const url = URL.createObjectURL(blob);
      imageUrls.set(mediaPath.split("/").pop() ?? "", url);
    }
  }

  // Get first slide
  const slideFile = zip.file("ppt/slides/slide1.xml");
  if (!slideFile) {
    throw new Error("No slide found in PPTX");
  }

  const slideXml = await slideFile.async("string");
  const parser = new DOMParser();
  const doc = parser.parseFromString(slideXml, "text/xml");

  // Parse background
  const bg = doc.querySelector("p\\:bg, bg");
  let backgroundColor = "#ffffff";
  if (bg) {
    const bgPr = bg.querySelector("p\\:bgPr, bgPr");
    if (bgPr) {
      const solidFill = bgPr.querySelector("a\\:solidFill, solidFill");
      if (solidFill) {
        const srgbClr = solidFill.querySelector("a\\:srgbClr, srgbClr");
        if (srgbClr) {
          backgroundColor = `#${srgbClr.getAttribute("val")}`;
        }
      }
    }
  }

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Parse shapes
  const shapeEls = doc.querySelectorAll("p\\:sp, sp");

  // Load slide relationships for image resolution
  const relsFile = zip.file("ppt/slides/_rels/slide1.xml.rels");
  const relsMap = new Map<string, string>();
  if (relsFile) {
    const relsXml = await relsFile.async("string");
    const relsDoc = parser.parseFromString(relsXml, "text/xml");
    relsDoc.querySelectorAll("Relationship").forEach((rel) => {
      const id = rel.getAttribute("Id") || "";
      const target = rel.getAttribute("Target") || "";
      relsMap.set(id, target);
    });
  }

  for (const shapeEl of shapeEls) {
    // Parse transform
    const xfrm = shapeEl.querySelector("a\\:xfrm, p\\:xfrm, xfrm");
    if (!xfrm) continue;
    const off = xfrm.querySelector("a\\:off, off");
    const ext = xfrm.querySelector("a\\:ext, ext");
    const x = off ? Number.parseInt(off.getAttribute("x") || "0") : 0;
    const y = off ? Number.parseInt(off.getAttribute("y") || "0") : 0;
    const width = ext ? Number.parseInt(ext.getAttribute("cx") || "0") : 0;
    const height = ext ? Number.parseInt(ext.getAttribute("cy") || "0") : 0;

    // Parse fill
    const spPr = shapeEl.querySelector("p\\:spPr, spPr");
    let fillColor: string | undefined;
    if (spPr) {
      const solidFill = spPr.querySelector("a\\:solidFill, solidFill");
      if (solidFill) {
        const srgbClr = solidFill.querySelector("a\\:srgbClr, srgbClr");
        if (srgbClr) {
          fillColor = `#${srgbClr.getAttribute("val")}`;
        }
      }
    }

    // Determine shape type
    const prstGeom = spPr?.querySelector("a\\:prstGeom, prstGeom");
    const prst = prstGeom?.getAttribute("prst");
    const isEllipse = prst?.includes("ellipse") || prst === "oval";

    // Parse text
    const txBody = shapeEl.querySelector("p\\:txBody, txBody");
    let text: string | undefined;
    let fontSize = 18;
    if (txBody) {
      const paragraphs = txBody.querySelectorAll("a\\:p, p");
      const texts: string[] = [];
      paragraphs.forEach((p) => {
        const textEls = p.querySelectorAll("a\\:t, t");
        const paraText: string[] = [];
        textEls.forEach((t) => {
          const tText = t.textContent;
          if (tText) paraText.push(tText);
        });
        if (paraText.length > 0) texts.push(paraText.join(""));
      });
      text = texts.join("\n");

      const rPr = txBody.querySelector("a\\:defRPr, defRPr");
      if (rPr) {
        const sz = rPr.getAttribute("sz");
        if (sz) fontSize = Number.parseInt(sz) / 100;
      }
    }

    // Draw shape
    const left = emuToPx(x);
    const top = emuToPxH(y);
    const w = emuToPx(width);
    const h = emuToPxH(height);

    if (isEllipse) {
      ctx.beginPath();
      ctx.ellipse(left + w / 2, top + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
    } else if (text) {
      // Text box
      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fillRect(left, top, w, h);
      }
      ctx.fillStyle = "#1a1a1a";
      const fs = Math.max(8, fontSize * scale * 0.75);
      ctx.font = `${fs}px "Segoe UI", "SF Pro Display", -apple-system, sans-serif`;
      ctx.textBaseline = "top";

      // Simple text wrapping
      const padding = 4 * scale;
      const maxWidth = w - padding * 2;
      const lineHeight = fs * 1.3;
      const words = text.split(/\s+/);
      let line = "";
      let ly = top + padding;
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && line) {
          ctx.fillText(line, left + padding, ly);
          line = word;
          ly += lineHeight;
          if (ly > top + h - padding) break;
        } else {
          line = testLine;
        }
      }
      if (line && ly <= top + h - padding) {
        ctx.fillText(line, left + padding, ly);
      }
    } else if (fillColor) {
      // Rectangle
      ctx.fillStyle = fillColor;
      ctx.fillRect(left, top, w, h);
    }
  }

  // Parse picture elements
  const picEls = doc.querySelectorAll("p\\:pic, pic");
  for (const picEl of picEls) {
    const xfrm = picEl.querySelector("a\\:xfrm, p\\:xfrm, xfrm");
    if (!xfrm) continue;
    const off = xfrm.querySelector("a\\:off, off");
    const ext = xfrm.querySelector("a\\:ext, ext");
    const x = off ? Number.parseInt(off.getAttribute("x") || "0") : 0;
    const y = off ? Number.parseInt(off.getAttribute("y") || "0") : 0;
    const width = ext ? Number.parseInt(ext.getAttribute("cx") || "0") : 0;
    const height = ext ? Number.parseInt(ext.getAttribute("cy") || "0") : 0;

    const blipFill = picEl.querySelector("a\\:blipFill, blipFill");
    const blip = blipFill?.querySelector("a\\:blip, blip");
    const embed = blip?.getAttribute("r:embed");
    if (!embed || !relsMap.has(embed)) continue;

    const target = relsMap.get(embed) || "";
    const imageName = target.split("/").pop() || "";
    const imageUrl = imageUrls.get(imageName);
    if (!imageUrl) continue;

    const left = emuToPx(x);
    const top = emuToPxH(y);
    const w = emuToPx(width);
    const h = emuToPxH(height);

    // Draw image
    try {
      const img = await loadImage(imageUrl);
      ctx.drawImage(img, left, top, w, h);
    } catch {
      // Ignore image loading errors
    }
  }

  // Cleanup blob URLs
  for (const url of imageUrls.values()) {
    URL.revokeObjectURL(url);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to encode PPTX thumbnail"));
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
