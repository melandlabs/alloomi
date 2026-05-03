"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import * as JSZipModule from "jszip";
import { toast } from "@/components/toast";

/** JSZip module type (export = JSZip, with both constructor and static methods like loadAsync) */
type JSZipType = import("jszip");
const JSZip = ((JSZipModule as { default?: JSZipType }).default ??
  JSZipModule) as JSZipType;
import { RemixIcon } from "@/components/remix-icon";
import { useTranslation } from "react-i18next";

interface PptxShape {
  id: string;
  type: "rect" | "ellipse" | "line" | "text" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  fillColor?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  imageUrl?: string;
  rotation?: number;
}

interface PptxSlide {
  index: number;
  title: string;
  content: string[];
  imageUrl?: string;
  renderedImageUrl?: string;
  shapes: PptxShape[];
  background?: string;
}

interface PptxPreviewProps {
  artifact: {
    path: string;
    name: string;
  };
  /** Optional taskId for workspace files - enables server-side high-fidelity rendering */
  taskId?: string;
}

const MAX_PREVIEW_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Read local PPTX file using Tauri fs plugin
 */
export function PptxPreview({ artifact, taskId }: PptxPreviewProps) {
  const { t } = useTranslation();
  const [slides, setSlides] = useState<PptxSlide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileTooLarge, setFileTooLarge] = useState<number | null>(null);
  const [serverRenderWarning, setServerRenderWarning] = useState<string | null>(
    null,
  );
  const [renderEngineStatusMessage, setRenderEngineStatusMessage] = useState<
    string | null
  >(null);
  const [renderAttemptKey, setRenderAttemptKey] = useState(0);

  const handleOpenExternal = async () => {
    if (!artifact.path) return;

    // Check if running in Tauri environment
    const isTauri = !!(window as any).__TAURI__;

    if (!isTauri) {
      // Web environment: show message
      console.warn(
        "[PptxPreview] Opening files externally is only supported in desktop app",
      );
      return;
    }

    try {
      const { openPathCustom } = await import("@/lib/tauri");
      await openPathCustom(artifact.path);
    } catch (err) {
      console.error("[PptxPreview] Failed to open file:", err);
      // Show user-friendly error
      setError(
        `Unable to open file: ${
          err instanceof Error ? err.message : "Please check app permissions"
        }`,
      );
    }
  };

  const handleShowInFolder = async () => {
    if (!artifact.path) return;
    const isTauri = !!(window as any).__TAURI__;
    if (!isTauri) return;
    try {
      const { revealItemInDir } = await import("@/lib/tauri");
      await revealItemInDir(artifact.path);
    } catch (err) {
      console.error("[PptxPreview] Failed to show in folder:", err);
    }
  };

  useEffect(() => {
    const blobUrls: string[] = [];
    let timeoutId: NodeJS.Timeout | null = null;
    let isCancelled = false;
    let statusPollInterval: NodeJS.Timeout | null = null;

    const clearPoll = () => {
      if (statusPollInterval) {
        clearInterval(statusPollInterval);
        statusPollInterval = null;
      }
    };

    async function loadPptx() {
      setServerRenderWarning(null);
      setRenderEngineStatusMessage(null);

      if (!artifact.path) {
        setError(t("common.pptxPreview.noPathAvailable"));
        setLoading(false);
        return;
      }

      // Set timeout - prevent long loading causing frontend crash
      timeoutId = setTimeout(() => {
        if (!isCancelled) {
          console.error("[PptxPreview] Loading timeout");
          setError(t("common.pptxPreview.loadTimeout"));
          setLoading(false);
        }
      }, 30000); // 30 second timeout

      // Check if in Tauri environment and taskId is provided for server-side rendering
      const isTauri = !!(window as any).__TAURI__;

      if (isTauri && taskId) {
        try {
          const { getRenderEngineStatus, ensureRenderEngineDownloadStarted } =
            await import("@/lib/tauri");
          const engineStatus = await getRenderEngineStatus();

          if (engineStatus?.available) {
            // Fetch server-side rendered slides
            const pptxPath = encodeURIComponent(artifact.path);
            const response = await fetch(
              `/api/workspace/pptx-preview/${encodeURIComponent(taskId)}/${pptxPath}`,
            );

            if (response.ok) {
              const manifest = await response.json();

              // Build slide data with rendered image URLs
              // Image URLs are served via /api/workspace/file/{taskId}/{path}?binary=true
              const serverSlides: PptxSlide[] = manifest.slides.map(
                (slide: {
                  index: number;
                  path: string;
                  width: number;
                  height: number;
                }) => ({
                  index: slide.index,
                  title: `Slide ${slide.index}`,
                  content: [],
                  renderedImageUrl: `/api/workspace/file/${encodeURIComponent(taskId)}/${encodeURIComponent(slide.path)}?binary=true`,
                  shapes: [],
                  background: "#ffffff",
                }),
              );

              setSlides(serverSlides);
              setRenderEngineStatusMessage(
                engineStatus.reason ||
                  "Using high-fidelity server-side rendering",
              );
              clearPoll();
              setLoading(false);
              return;
            }
            console.warn(
              "[PptxPreview] Server-side rendering failed, falling back to client-side:",
              response.status,
            );
            setServerRenderWarning(
              "High-fidelity rendering unavailable, using simplified preview",
            );
          } else {
            setRenderEngineStatusMessage(
              engineStatus?.reason || "Render engine not installed",
            );
            const startedStatus = await ensureRenderEngineDownloadStarted();
            const isDownloading = startedStatus?.downloading || false;

            setServerRenderWarning(
              isDownloading
                ? t("common.pptxPreview.highFidelityLoading")
                : t("common.pptxPreview.highFidelityUnavailable"),
            );

            if (isDownloading) {
              toast({
                type: "info",
                description: t("common.pptxPreview.highFidelityLoadingToast"),
                duration: 3500,
              });
              statusPollInterval = setInterval(async () => {
                try {
                  const status = await getRenderEngineStatus();
                  if (status?.available && !isCancelled) {
                    clearPoll();
                    setRenderEngineStatusMessage(
                      status.reason ||
                        t("common.pptxPreview.highFidelityReady"),
                    );
                    setServerRenderWarning(null);
                    toast({
                      type: "success",
                      description: t("common.pptxPreview.highFidelityReady"),
                      duration: 2500,
                    });
                    setRenderAttemptKey((prev) => prev + 1);
                  } else if (status?.error_message && !status.downloading) {
                    clearPoll();
                  }
                } catch {
                  clearPoll();
                }
              }, 5000);
            }
          }
        } catch (err) {
          console.error("[PptxPreview] Error checking render engine:", err);
          setServerRenderWarning(
            t("common.pptxPreview.renderEngineCheckFailed"),
          );
        }
      }

      try {
        // Only use custom commands in Tauri desktop environment
        const { readFileBinary, fileStat } = await import("@/lib/tauri");

        // Check file size first
        const fileInfo = await fileStat(artifact.path);
        if (!fileInfo) {
          setError(t("common.pptxPreview.getFileInfoFailed"));
          setLoading(false);
          return;
        }
        if (fileInfo.size > MAX_PREVIEW_SIZE) {
          setFileTooLarge(fileInfo.size);
          setLoading(false);
          return;
        }

        // Read file using Tauri custom command
        const data = await readFileBinary(artifact.path);
        if (!data) {
          setError(t("common.pptxPreview.readFileFailed"));
          setLoading(false);
          return;
        }
        // Create a proper Uint8Array slice with correct offset and length
        const sourceArray = new Uint8Array(
          data.buffer,
          data.byteOffset,
          data.byteLength,
        );
        const arrayBuffer = sourceArray.buffer.slice(
          sourceArray.byteOffset,
          sourceArray.byteOffset + sourceArray.byteLength,
        ) as ArrayBuffer;

        if (isCancelled) {
          return;
        }

        // Check if this is a valid ZIP/PPTX file (should start with PK header: 50 4b)
        const headerView = new Uint8Array(arrayBuffer.slice(0, 4));
        const isZipFile = headerView[0] === 0x50 && headerView[1] === 0x4b; // "PK" signature

        if (!isZipFile) {
          console.warn(
            "[PptxPreview] Not a valid ZIP/PPTX file, treating as text",
          );
          // Not a ZIP file - likely a text file with .pptx extension
          // Try to display it as plain text
          const decoder = new TextDecoder("utf-8", { fatal: false });
          try {
            const textContent = decoder.decode(arrayBuffer);
            // Create a single slide with the text content
            const textSlide: PptxSlide = {
              index: 0,
              title:
                artifact.name || t("common.pptxPreview.defaultDocumentTitle"),
              content: textContent.split(/\n\n+/).filter((line) => line.trim()),
              shapes: [],
              background: "#ffffff",
            };
            setSlides([textSlide]);
            setError(null);
            setLoading(false);
            return;
          } catch (decodeErr) {
            console.error("[PptxPreview] Failed to decode as text:", decodeErr);
            throw new Error(t("common.pptxPreview.invalidFileFormat"));
          }
        }

        // Parse PPTX using JSZip
        const zip = await JSZip.loadAsync(arrayBuffer, {
          // Limit parsing options for better performance
          checkCRC32: false,
        });

        // Extract images from ppt/media/
        const newImageUrls = new Map<string, string>();
        const mediaFiles = Object.keys(zip.files).filter((name) =>
          name.startsWith("ppt/media/"),
        );
        for (const mediaPath of mediaFiles) {
          const file = zip.files[mediaPath];
          if (!file.dir) {
            const blob = await file.async("blob");
            const url = URL.createObjectURL(blob);
            blobUrls.push(url);
            const fileName = mediaPath.split("/").pop() || "";
            newImageUrls.set(fileName, url);
          }
        }

        // Get slide count from presentation.xml
        const presentationXml = await zip
          .file("ppt/presentation.xml")
          ?.async("string");
        if (!presentationXml) {
          throw new Error(t("common.pptxPreview.missingPresentationXml"));
        }

        // Helper function to parse color
        const parseColor = (colorEl: Element): string | undefined => {
          const srgbVal = colorEl
            .querySelector("a\\:srgbClr, srgbClr")
            ?.getAttribute("val");
          if (srgbVal) {
            return `#${srgbVal}`;
          }
          const schemeVal = colorEl
            .querySelector("a\\:schemeClr, schemeClr")
            ?.getAttribute("val");
          if (schemeVal) {
            // Map theme colors to hex (basic mapping)
            const themeColors: Record<string, string> = {
              lt1: "#FFFFFF",
              dk1: "#000000",
              lt2: "#E7E6E6",
              dk2: "#1F1F1F",
              accent1: "#4472C4",
              accent2: "#ED7D31",
              accent3: "#A5A5A5",
              accent4: "#FFC000",
              accent5: "#5B9BD5",
              accent6: "#70AD47",
              hlink: "#0563C1",
              folHlink: "#954F72",
            };
            return themeColors[schemeVal] || undefined;
          }
          return undefined;
        };

        // Helper function to parse shape transform (position and size)
        const parseTransform = (shapeEl: Element) => {
          const xfrm = shapeEl.querySelector("a\\:xfrm, p\\:xfrm, xfrm");
          if (!xfrm) return null;

          const off = xfrm.querySelector("a\\:off, off");
          const ext = xfrm.querySelector("a\\:ext, ext");

          return {
            x: off ? Number.parseInt(off.getAttribute("x") || "0") : 0,
            y: off ? Number.parseInt(off.getAttribute("y") || "0") : 0,
            width: ext ? Number.parseInt(ext.getAttribute("cx") || "0") : 0,
            height: ext ? Number.parseInt(ext.getAttribute("cy") || "0") : 0,
          };
        };

        // Helper function to parse fill
        const parseFill = (shapeEl: Element): string | undefined => {
          const spPr = shapeEl.querySelector("p\\:spPr, spPr");
          if (!spPr) return undefined;

          // Solid fill
          const solidFill = spPr.querySelector("a\\:solidFill, solidFill");
          if (solidFill) {
            const srgbClr = solidFill.querySelector("a\\:srgbClr, srgbClr");
            if (srgbClr) {
              return `#${srgbClr.getAttribute("val")}`;
            }
          }

          // Gradient fill (use first color)
          const gradFill = spPr.querySelector("a\\:gradFill, gradFill");
          if (gradFill) {
            const gs = gradFill.querySelector("a\\:gs, gs");
            if (gs) {
              const color = parseColor(gs);
              if (color) return color;
            }
          }

          return undefined;
        };

        // Parse slides
        const parsedSlides: PptxSlide[] = [];
        let slideIndex = 1;

        while (true) {
          const slideFile = zip.file(`ppt/slides/slide${slideIndex}.xml`);
          if (!slideFile) break;

          const slideXml = await slideFile.async("string");

          // Parse slide content
          const parser = new DOMParser();
          const doc = parser.parseFromString(slideXml, "text/xml");

          // Extract text content
          const textElements = doc.querySelectorAll("a\\:t, t");
          const textContent: string[] = [];
          let title = "";

          textElements.forEach((el, idx) => {
            const text = el.textContent?.trim();
            if (text) {
              if (idx === 0 && !title) {
                title = text;
              } else {
                textContent.push(text);
              }
            }
          });

          // Parse shapes
          const shapes: PptxShape[] = [];
          const shapeElements = doc.querySelectorAll("p\\:sp, sp");
          let shapeCounter = 0;

          shapeElements.forEach((shapeEl) => {
            const transform = parseTransform(shapeEl);
            if (!transform) return;

            const fill = parseFill(shapeEl);
            const nvSpPr = shapeEl.querySelector("p\\:nvSpPr, nvSpPr");
            const type = nvSpPr?.getAttribute("type");

            // Extract text from shape
            const txBody = shapeEl.querySelector("p\\:txBody, txBody");
            let text: string | undefined;
            let fontSize = 18;
            const color = "#000000";

            if (txBody) {
              const paragraphs = txBody.querySelectorAll("a\\:p, p");
              const texts: string[] = [];
              paragraphs.forEach((p) => {
                // Get ALL text elements in the paragraph, not just the first one
                const textElements = p.querySelectorAll("a\\:t, t");
                const paragraphText: string[] = [];
                textElements.forEach((t) => {
                  const tText = t.textContent;
                  if (tText) paragraphText.push(tText);
                });
                if (paragraphText.length > 0) {
                  texts.push(paragraphText.join(""));
                }
              });
              text = texts.join("\n");

              // Get text properties - try both defRPr and rPr (run properties)
              let rPr = txBody.querySelector("a\\:defRPr, defRPr");
              if (!rPr) {
                // Try to get from the first paragraph's run properties
                const firstP = txBody.querySelector("a\\:p, p");
                if (firstP) {
                  rPr = firstP.querySelector("a\\:rPr, rPr");
                }
              }
              if (rPr) {
                const sz = rPr.getAttribute("sz");
                if (sz) fontSize = Number.parseInt(sz) / 100;
              }
            }

            // Determine shape type
            let shapeType: "rect" | "ellipse" | "line" | "text" = "rect";
            // Check for ellipse preset shapes
            const spPr = shapeEl.querySelector("p\\:spPr, spPr");
            const prstGeom = spPr?.querySelector("a\\:prstGeom, prstGeom");
            const prst = prstGeom?.getAttribute("prst");
            if (prst?.includes("ellipse") || prst === "oval") {
              shapeType = "ellipse";
            } else if (text) {
              // Text boxes should prioritize text display
              shapeType = "text";
            }

            shapes.push({
              id: `shape-${slideIndex}-${shapeCounter++}`,
              type: shapeType,
              x: transform.x,
              y: transform.y,
              width: transform.width,
              height: transform.height,
              fillColor: fill,
              text,
              fontSize,
              color,
            });
          });

          // Parse picture elements
          const picElements = doc.querySelectorAll("p\\:pic, pic");
          const relsFile = zip.file(
            `ppt/slides/_rels/slide${slideIndex}.xml.rels`,
          );

          const relsMap = new Map<string, string>();
          if (relsFile) {
            const relsXml = await relsFile.async("string");
            const relsDoc = parser.parseFromString(relsXml, "text/xml");
            const relationships = relsDoc.querySelectorAll("Relationship");

            relationships.forEach((rel) => {
              const id = rel.getAttribute("Id") || "";
              const target = rel.getAttribute("Target") || "";
              relsMap.set(id, target);
            });
          }

          picElements.forEach((picEl) => {
            const transform = parseTransform(picEl);
            if (!transform) return;

            const blipFill = picEl.querySelector("a\\:blipFill, blipFill");
            const blip = blipFill?.querySelector("a\\:blip, blip");
            const embed = blip?.getAttribute("r:embed");

            if (embed && relsMap.has(embed)) {
              const target = relsMap.get(embed);
              if (!target) return;

              const imageName = target.split("/").pop() || "";
              if (newImageUrls.has(imageName)) {
                shapes.push({
                  id: `pic-${slideIndex}-${shapeCounter++}`,
                  type: "image",
                  x: transform.x,
                  y: transform.y,
                  width: transform.width,
                  height: transform.height,
                  imageUrl: newImageUrls.get(imageName),
                });
              }
            }
          });

          // Legacy: Try to find a single main image reference for backward compatibility
          let slideImageUrl: string | undefined;
          if (relsFile) {
            const relsXml = await relsFile.async("string");
            const relsDoc = parser.parseFromString(relsXml, "text/xml");
            const relationships = relsDoc.querySelectorAll("Relationship");

            relationships.forEach((rel) => {
              const type = rel.getAttribute("Type") || "";
              const target = rel.getAttribute("Target") || "";

              if (type.includes("image") && target.includes("media/")) {
                const imageName = target.split("/").pop() || "";
                if (newImageUrls.has(imageName)) {
                  slideImageUrl = newImageUrls.get(imageName);
                }
              }
            });
          }

          // Parse background
          const bg = doc.querySelector("p\\:bg, bg");
          let background: string | undefined;
          if (bg) {
            const bgPr = bg.querySelector("p\\:bgPr, bgPr");
            if (bgPr) {
              const solidFill = bgPr.querySelector("a\\:solidFill, solidFill");
              if (solidFill) {
                const srgbClr = solidFill.querySelector("a\\:srgbClr, srgbClr");
                if (srgbClr) {
                  background = `#${srgbClr.getAttribute("val")}`;
                }
              }
            }
          }

          parsedSlides.push({
            index: slideIndex,
            title: title || `${t("common.pptxPreview.slide")} ${slideIndex}`,
            content: textContent,
            imageUrl: slideImageUrl,
            shapes,
            background,
          });

          slideIndex++;
        }

        if (parsedSlides.length === 0) {
          throw new Error(t("common.pptxPreview.noSlidesFound"));
        }

        setSlides(parsedSlides);
        setError(null);
      } catch (err) {
        console.error("[PptxPreview] Failed to load PPTX:", err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
      } finally {
        // Cleanup timeout timer
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        setLoading(false);
      }
    }

    loadPptx();

    // Cleanup blob URLs on unmount
    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      clearPoll();
      blobUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [artifact.path, renderAttemptKey, t, taskId]);

  // Navigate slides
  const goToPrev = () => {
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
  };

  const goToNext = () => {
    if (currentSlide < slides.length - 1) setCurrentSlide(currentSlide + 1);
  };

  if (loading) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <RemixIcon
          name="loader_2"
          size="size-8"
          className="text-muted-foreground animate-spin"
        />
        <p className="text-muted-foreground mt-4 text-sm">
          {t("common.pptxPreview.loading")}
        </p>
      </div>
    );
  }

  if (fileTooLarge !== null) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="border-border bg-background mb-4 flex size-20 items-center justify-center rounded-xl border">
            <RemixIcon
              name="presentation"
              size="size-10"
              className="text-orange-500"
            />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            {artifact.name}
          </h3>
          <p className="text-muted-foreground mb-4 text-sm">
            {t("common.pptxPreview.fileTooLargeDesc", {
              size: (fileTooLarge / 1024 / 1024).toFixed(1),
            })}
          </p>
          <button
            type="button"
            onClick={handleOpenExternal}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <RemixIcon name="external_link" size="size-4" />
            {t("common.pptxPreview.openInPowerPoint")}
          </button>
        </div>
      </div>
    );
  }

  if (error || slides.length === 0) {
    return (
      <div className="bg-muted/20 flex h-full flex-col items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="border-border bg-background mb-4 flex size-20 items-center justify-center rounded-xl border">
            <RemixIcon
              name="presentation"
              size="size-10"
              className="text-orange-500"
            />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            {artifact.name}
          </h3>
          <p className="text-muted-foreground mb-4 text-sm break-all whitespace-pre-wrap">
            {error || t("common.pptxPreview.noSlidesAvailable")}
          </p>
          <button
            type="button"
            onClick={handleOpenExternal}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <RemixIcon name="external_link" size="size-4" />
            {t("common.pptxPreview.openInPowerPoint")}
          </button>
        </div>
      </div>
    );
  }

  const slide = slides[currentSlide];

  return (
    <div className="bg-muted/30 flex h-full flex-col">
      {/* Server render warning banner */}
      {serverRenderWarning && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2">
          <div className="flex items-center gap-2 text-amber-800 text-sm">
            <RemixIcon name="alert" size="size-4" />
            <span>{serverRenderWarning}</span>
          </div>
        </div>
      )}
      {renderEngineStatusMessage && !serverRenderWarning && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2">
          <div className="flex items-center gap-2 text-emerald-800 text-sm">
            <RemixIcon name="checkbox_circle" size="size-4" />
            <span>{renderEngineStatusMessage}</span>
          </div>
        </div>
      )}
      {/* Slide display */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
        {/* Navigation buttons */}
        <button
          type="button"
          onClick={goToPrev}
          disabled={currentSlide === 0}
          className={cn(
            "absolute left-4 z-10 flex size-10 items-center justify-center rounded-full transition-all",
            "bg-background/80 hover:bg-background shadow-lg",
            "disabled:cursor-not-allowed disabled:opacity-30",
          )}
        >
          <RemixIcon
            name="chevron_left"
            size="size-5"
            className="text-foreground"
          />
        </button>

        <button
          type="button"
          onClick={goToNext}
          disabled={currentSlide === slides.length - 1}
          className={cn(
            "absolute right-4 z-10 flex size-10 items-center justify-center rounded-full transition-all",
            "bg-background/80 hover:bg-background shadow-lg",
            "disabled:cursor-not-allowed disabled:opacity-30",
          )}
        >
          <RemixIcon
            name="chevron_right"
            size="size-5"
            className="text-foreground"
          />
        </button>

        {/* Slide content */}
        <div
          className="relative aspect-[16/9] w-full max-w-4xl overflow-hidden rounded-lg shadow-xl"
          style={{ backgroundColor: slide.background || "#ffffff" }}
        >
          {/* Render shapes */}
          <div className="absolute inset-0">
            {slide.shapes && slide.shapes.length > 0 ? (
              slide.shapes.map((shape) => {
                // Convert EMU units (English Metric Units) to pixels
                // 914400 EMU = 1 inch, typical slide is 10x7.5 inches
                const emuToPercent = (value: number, maxValue: number) => {
                  return (value / maxValue) * 100;
                };

                // PPTX standard slide size: 9144000 x 6858000 EMU (10 x 7.5 inches at 96 DPI)
                const slideWidth = 9144000;
                const slideHeight = 6858000;

                const left = emuToPercent(shape.x, slideWidth);
                const top = emuToPercent(shape.y, slideHeight);
                const width = emuToPercent(shape.width, slideWidth);
                const height = emuToPercent(shape.height, slideHeight);

                const baseStyle = {
                  position: "absolute" as const,
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${width}%`,
                  height: `${height}%`,
                };

                if (shape.type === "image" && shape.imageUrl) {
                  return (
                    <img
                      key={shape.id}
                      src={shape.imageUrl}
                      alt=""
                      style={baseStyle}
                      className="object-contain"
                    />
                  );
                }

                if (shape.type === "rect") {
                  return (
                    <div
                      key={shape.id}
                      style={{
                        ...baseStyle,
                        backgroundColor: shape.fillColor || "transparent",
                      }}
                    />
                  );
                }

                if (shape.type === "ellipse") {
                  return (
                    <div
                      key={shape.id}
                      style={{
                        ...baseStyle,
                        backgroundColor: shape.fillColor || "transparent",
                        borderRadius: "50%",
                      }}
                    />
                  );
                }

                if (shape.type === "text" && shape.text) {
                  return (
                    <div
                      key={shape.id}
                      style={{
                        ...baseStyle,
                        backgroundColor: shape.fillColor || "transparent",
                        color: shape.color || "#000000",
                        fontSize: `${shape.fontSize || 18}px`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        padding: "8px",
                      }}
                    >
                      {shape.text}
                    </div>
                  );
                }

                return null;
              })
            ) : slide.renderedImageUrl ? (
              // Server-rendered high-fidelity slide image
              <div className="relative h-full w-full">
                <img
                  src={slide.renderedImageUrl}
                  alt={slide.title}
                  className="h-full w-full object-contain"
                />
                {(slide.title || slide.content.length > 0) && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-6">
                    {slide.title && (
                      <h2 className="mb-2 text-xl font-bold text-white">
                        {slide.title}
                      </h2>
                    )}
                  </div>
                )}
              </div>
            ) : slide.imageUrl ? (
              // Legacy: Fallback to old image-based rendering
              <div className="relative h-full w-full">
                <img
                  src={slide.imageUrl}
                  alt={slide.title}
                  className="h-full w-full object-contain"
                />
                {(slide.title || slide.content.length > 0) && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-6">
                    {slide.title && (
                      <h2 className="mb-2 text-xl font-bold text-white">
                        {slide.title}
                      </h2>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // Legacy: Fallback to old text-only rendering
              <div className="flex h-full w-full flex-col p-8">
                {slide.title && (
                  <h2 className="text-foreground mb-6 text-2xl font-bold">
                    {slide.title}
                  </h2>
                )}
                <div className="flex-1 overflow-auto">
                  {slide.content.map((text, idx) => (
                    <p
                      key={`${slide.index}-${text}-${idx}`}
                      className="text-foreground/80 mb-3 text-base"
                    >
                      {text}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Page indicator */}
          <div className="text-muted-foreground bg-muted/80 absolute right-4 bottom-4 rounded-md px-3 py-1.5 text-xs">
            {currentSlide + 1} / {slides.length}
          </div>
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="border-border bg-background shrink-0 border-t">
        <div className="flex gap-2 overflow-x-auto p-3">
          {slides.map((s, index) => (
            <button
              key={s.index}
              type="button"
              onClick={() => setCurrentSlide(index)}
              className={cn(
                "aspect-[16/9] w-24 shrink-0 cursor-pointer overflow-hidden rounded-md border-2 transition-all relative",
                index === currentSlide
                  ? "border-primary shadow-md"
                  : "border-border hover:border-primary/50",
              )}
            >
              {s.shapes && s.shapes.length > 0 ? (
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: s.background || "#ffffff" }}
                >
                  {s.shapes.slice(0, 5).map((shape) => {
                    // Simplified thumbnail rendering
                    const slideWidth = 9144000;
                    const slideHeight = 6858000;
                    const left = (shape.x / slideWidth) * 100;
                    const top = (shape.y / slideHeight) * 100;
                    const width = (shape.width / slideWidth) * 100;
                    const height = (shape.height / slideHeight) * 100;

                    if (shape.type === "image" && shape.imageUrl) {
                      return (
                        <img
                          key={shape.id}
                          src={shape.imageUrl}
                          alt=""
                          className="absolute object-cover"
                          style={{
                            left: `${left}%`,
                            top: `${top}%`,
                            width: `${width}%`,
                            height: `${height}%`,
                          }}
                        />
                      );
                    }

                    if (shape.type === "rect") {
                      return (
                        <div
                          key={shape.id}
                          className="absolute"
                          style={{
                            left: `${left}%`,
                            top: `${top}%`,
                            width: `${width}%`,
                            height: `${height}%`,
                            backgroundColor: shape.fillColor || "#cccccc",
                          }}
                        />
                      );
                    }

                    return null;
                  })}
                </div>
              ) : s.renderedImageUrl ? (
                <img
                  src={s.renderedImageUrl}
                  alt={s.title}
                  className="h-full w-full object-cover"
                />
              ) : s.imageUrl ? (
                <img
                  src={s.imageUrl}
                  alt={s.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="bg-muted/50 flex h-full w-full flex-col items-start justify-start p-1.5">
                  <span className="text-foreground line-clamp-2 text-[8px] font-medium">
                    {s.title}
                  </span>
                  {s.content.length > 0 && (
                    <span className="text-muted-foreground mt-0.5 line-clamp-2 text-[6px]">
                      {s.content[0]}
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
