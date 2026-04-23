/**
 * Document parsers using LangChain document loaders.
 * Supports PDF, Word, PowerPoint, Excel, CSV, Text, and Markdown files.
 * Also supports Apple office suite formats (.pages, .numbers, .keynote).
 */

import { Document } from "@langchain/core/documents";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import JSZip from "jszip";

// ---------------------------------------------------------------------------
// Configurable parsers config (defaults; can be overridden per-app)
// ---------------------------------------------------------------------------

export interface ParsersConfig {
  estimateTokens: (text: string) => number;
  pdfMaxPages?: number;
  pdfMaxSizeMb?: number;
  preferNativePdf?: boolean;
}

let _config: ParsersConfig | null = null;

export function configureParsers(config: ParsersConfig): void {
  _config = config;
}

function getConfig(): ParsersConfig {
  if (!_config) {
    throw new Error(
      "RAG parsers not configured. Call configureParsers() with { estimateTokens } first.",
    );
  }
  return _config;
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

// Simple text loader implementation
export class TextLoader {
  constructor(private filePath: string) {}

  async load(): Promise<Document[]> {
    const text = await readFile(this.filePath, "utf-8");
    return [
      new Document({
        pageContent: text,
        metadata: { source: this.filePath },
      }),
    ];
  }
}

/**
 * Apple document loader.
 * Extracts text content from .pages, .numbers, .keynote files.
 * Apple files are ZIP format, containing QuickLook/Preview.pdf for preview.
 * For text extraction, we try to extract the preview PDF or parse internal XML.
 */
export class AppleDocumentLoader {
  constructor(private filePath: string) {}

  async load(): Promise<Document[]> {
    try {
      const fileBuffer = await readFile(this.filePath);
      const zip = await JSZip.loadAsync(fileBuffer);

      // Try to extract text from preview PDF
      const previewPath = "QuickLook/Preview.pdf";
      const previewFile = zip.file(previewPath);

      if (previewFile) {
        // Save preview PDF to temp file, then use PDFLoader (lazy loaded)
        const tempPdfPath = join(tmpdir(), `apple_preview_${Date.now()}.pdf`);
        try {
          const pdfData = await previewFile.async("uint8array");
          await writeFile(tempPdfPath, Buffer.from(pdfData));
          const { PDFLoader } =
            await import("@langchain/community/document_loaders/fs/pdf");
          const loader = new PDFLoader(tempPdfPath, { splitPages: false });
          return await loader.load();
        } finally {
          try {
            await unlink(tempPdfPath);
          } catch {
            // Ignore cleanup errors
          }
        }
      }

      // If no preview PDF, try to extract internal XML content
      const indexXmlPath = "index.xml";
      const indexFile = zip.file(indexXmlPath);

      if (indexFile) {
        const content = await indexFile.async("text");
        return [
          new Document({
            pageContent: content,
            metadata: { source: this.filePath, type: "apple-document" },
          }),
        ];
      }

      // Try to find other possible document files
      const documentDir = zip.folder("Document");
      if (documentDir) {
        const files = Object.keys(documentDir.files);
        for (const fileName of files) {
          if (fileName.endsWith(".xml")) {
            const file = zip.file(fileName);
            if (file) {
              const content = await file.async("text");
              return [
                new Document({
                  pageContent: content,
                  metadata: { source: this.filePath, type: "apple-document" },
                }),
              ];
            }
          }
        }
      }

      throw new Error(
        "Cannot parse Apple document. The file may not have an iCloud preview PDF. Please open the file on Mac, go to File > Export As > PDF, and upload the exported PDF instead.",
      );
    } catch (error) {
      console.error(
        "[AppleDocumentLoader] Failed to load Apple document:",
        error,
      );
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileContent {
  text: string;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getExtension(contentType: string): string {
  const typeMap: Record<string, string> = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      ".docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      ".pptx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      ".xlsx",
    "text/plain": ".txt",
    "text/markdown": ".md",
    "text/csv": ".csv",
    "application/vnd.ms-excel": ".xls",
    "application/msword": ".doc",
    "application/vnd.ms-powerpoint": ".ppt",
  };

  return typeMap[contentType] || ".bin";
}

/**
 * Get the page count of a PDF file from buffer.
 * Uses pdfjs-dist for accurate page count.
 */
export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  try {
    // Use legacy build in Node.js to avoid browser-only globals like DOMMatrix.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;
    return pdf.numPages;
  } catch (error) {
    console.error("[getPdfPageCount] Error:", error);
    // Fallback: try using PDFLoader which also provides page count
    const extension = ".pdf";
    const tempFilePath = join(
      tmpdir(),
      `temp_pdf_pages_${Date.now()}${extension}`,
    );
    try {
      await writeFile(tempFilePath, buffer);
      const { PDFLoader } =
        await import("@langchain/community/document_loaders/fs/pdf");
      const loader = new PDFLoader(tempFilePath, { splitPages: false });
      const docs = await loader.load();
      return docs.length;
    } finally {
      try {
        await unlink(tempFilePath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Check if a PDF should use native PDF API based on page count and size.
 * Returns { shouldUseNative: boolean; reason?: string }
 */
export function shouldUseNativePdf(
  pageCount: number,
  bufferSizeBytes: number,
): { shouldUseNative: boolean; reason?: string } {
  const cfg = getConfig();
  const sizeMB = bufferSizeBytes / (1024 * 1024);
  const maxPages = cfg.pdfMaxPages ?? 50;
  const maxSizeMb = cfg.pdfMaxSizeMb ?? 50;
  const preferNative = cfg.preferNativePdf ?? true;

  if (!preferNative) {
    return {
      shouldUseNative: false,
      reason: "PREFER_NATIVE_PDF is disabled",
    };
  }

  if (pageCount > maxPages) {
    return {
      shouldUseNative: false,
      reason: `PDF has ${pageCount} pages, exceeds limit of ${maxPages}`,
    };
  }

  if (sizeMB > maxSizeMb) {
    return {
      shouldUseNative: false,
      reason: `PDF size is ${sizeMB.toFixed(2)}MB, exceeds limit of ${maxSizeMb}MB`,
    };
  }

  return { shouldUseNative: true };
}

/**
 * Convert a .doc file to .docx using LibreOffice via soffice.py.
 * soffice.py is located under skills/docx/scripts/office/
 */
function convertDocToDocx(docPath: string): string {
  // Resolve soffice.py relative to the project root (assumes this file is in packages/rag/src/)
  const scriptDir = join(process.cwd(), "skills", "docx", "scripts", "office");
  const outDir = tmpdir();
  const stem = docPath.replace(/\.doc$/, "");
  const outPath = join(outDir, `${basename(stem)}.docx`);

  try {
    execFileSync(
      "python",
      [
        join(scriptDir, "soffice.py"),
        "--headless",
        "--convert-to",
        "docx",
        "--outdir",
        outDir,
        docPath,
      ],
      { stdio: "pipe" },
    );
  } catch (e) {
    throw new Error(`Failed to convert .doc to .docx: ${e}`);
  }

  if (!existsSync(outPath)) {
    throw new Error(".doc conversion produced no output");
  }
  return outPath;
}

/**
 * Get the appropriate LangChain document loader for the content type.
 * Uses dynamic imports to lazy-load LangChain modules only when needed.
 */
async function getLoader(
  contentType: string,
  filePath: string,
  tempDocxPaths: Set<string>,
) {
  switch (contentType) {
    case "application/pdf": {
      const { PDFLoader } =
        await import("@langchain/community/document_loaders/fs/pdf");
      return new PDFLoader(filePath, {
        splitPages: false, // Return entire document as one page
      });
    }

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const { DocxLoader } =
        await import("@langchain/community/document_loaders/fs/docx");
      return new DocxLoader(filePath);
    }

    case "application/msword": {
      // Auto-convert .doc → .docx, then use DocxLoader
      const docxPath = convertDocToDocx(filePath);
      tempDocxPaths.add(docxPath);
      const { DocxLoader } =
        await import("@langchain/community/document_loaders/fs/docx");
      return new DocxLoader(docxPath);
    }

    case "text/csv": {
      const { CSVLoader } =
        await import("@langchain/community/document_loaders/fs/csv");
      return new CSVLoader(filePath, "text");
    }

    case "text/plain":
    case "text/markdown":
      return new TextLoader(filePath);

    // Apple office suite formats (new)
    case "application/vnd.apple.pages":
    case "application/vnd.apple.numbers":
    case "application/vnd.apple.keynote":
    // Apple office suite formats (legacy macOS)
    case "application/x-iwork-pages-sffpages":
    case "application/x-iwork-numbers-sffnumbers":
    case "application/x-iwork-keynote-sffkeynote":
      return new AppleDocumentLoader(filePath);

    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse file buffer and extract text content.
 */
export async function parseFile(
  buffer: Buffer,
  contentType: string,
): Promise<FileContent> {
  // Create a temporary file
  const extension = getExtension(contentType);
  const tempFilePath = join(tmpdir(), `temp_${Date.now()}${extension}`);
  const tempDocxPaths = new Set<string>();

  try {
    // Write buffer to temp file
    await writeFile(tempFilePath, buffer);

    // Get appropriate loader (lazy-loaded via dynamic import)
    const loader = await getLoader(contentType, tempFilePath, tempDocxPaths);

    // Load and parse document
    const docs = await loader.load();

    if (!docs || docs.length === 0) {
      throw new Error("No content extracted from document");
    }

    // Extract text from all documents/pages
    const text = docs.map((doc) => doc.pageContent).join("\n\n");

    // Combine metadata
    const metadata: Record<string, unknown> = {
      source: tempFilePath,
      contentType,
      pages: docs.length,
    };

    // Add file-specific metadata
    if (docs.length > 0 && docs[0].metadata) {
      Object.assign(metadata, docs[0].metadata);
    }

    return { text, metadata };
  } finally {
    // Clean up temp file
    try {
      await unlink(tempFilePath);
    } catch (error) {
      console.error("[parseFile] Failed to delete temp file:", error);
    }
    // Clean up any converted .docx temp files
    for (const docxPath of tempDocxPaths) {
      try {
        await unlink(docxPath);
      } catch (error) {
        console.error("[parseFile] Failed to delete temp docx:", error);
      }
    }
  }
}

/**
 * Parse file buffer and return LangChain Document.
 */
export async function parseFileToDocument(
  buffer: Buffer,
  contentType: string,
  fileName: string,
): Promise<Document> {
  const { text, metadata } = await parseFile(buffer, contentType);

  return new Document({
    pageContent: text,
    metadata: {
      ...metadata,
      fileName,
      contentType,
    },
  });
}

/**
 * Estimate if text might be too long for single embedding.
 */
export function estimateChunkCount(text: string): number {
  const cfg = getConfig();
  const estimatedTokens = cfg.estimateTokens(text);
  return Math.ceil(estimatedTokens / 500);
}

/**
 * Validate if content type is supported.
 */
export function isSupportedContentType(contentType: string): boolean {
  const supportedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/vnd.apple.pages",
    "application/vnd.apple.numbers",
    "application/vnd.apple.keynote",
    // Apple office suite formats (legacy macOS)
    "application/x-iwork-pages-sffpages",
    "application/x-iwork-numbers-sffnumbers",
    "application/x-iwork-keynote-sffkeynote",
    "text/plain",
    "text/markdown",
    "text/csv",
  ];

  return supportedTypes.includes(contentType);
}
