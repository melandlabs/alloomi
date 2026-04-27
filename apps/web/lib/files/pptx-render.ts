import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  type Stats,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, extname, isAbsolute, join, resolve, sep } from "node:path";
import sharp from "sharp";
import { getTaskSessionDir } from "@/lib/files/workspace/sessions";

const PPTX_RENDER_CACHE_DIR = ".alloomi-preview/pptx";
const DEFAULT_SLIDE_WIDTH = 1600;
const DEFAULT_SLIDE_HEIGHT = 900;

export interface PptxRenderedSlide {
  index: number;
  path: string;
  width: number;
  height: number;
}

export interface PptxRenderManifest {
  version: 1;
  sourcePath: string;
  sourceMtimeMs: number;
  sourceSize: number;
  cacheKey: string;
  slideCount: number;
  pdfPath: string;
  slides: PptxRenderedSlide[];
  generatedAt: string;
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function toSessionRelative(taskId: string, absolutePath: string): string {
  const sessionDir = resolve(getTaskSessionDir(taskId));
  const normalizedSessionDir = sessionDir.endsWith("/")
    ? sessionDir
    : `${sessionDir}/`;

  if (!absolutePath.startsWith(normalizedSessionDir)) {
    throw new Error("Rendered preview escaped session directory");
  }

  return absolutePath.slice(normalizedSessionDir.length);
}

function resolvePptxPath(taskId: string, sourcePath: string): string {
  const sessionDir = resolve(getTaskSessionDir(taskId));

  if (isAbsolute(sourcePath)) {
    const resolvedAbsolute = resolve(sourcePath);
    if (
      resolvedAbsolute.startsWith(sessionDir + sep) ||
      resolvedAbsolute === sessionDir
    ) {
      return resolvedAbsolute;
    }
    throw new Error("PPTX path escaped session directory");
  }

  const resolvedRelative = resolve(join(sessionDir, sourcePath));
  if (
    !resolvedRelative.startsWith(sessionDir + sep) &&
    resolvedRelative !== sessionDir
  ) {
    throw new Error("PPTX path escaped session directory");
  }

  return resolvedRelative;
}

function getRepoRoot(): string {
  return resolve(process.cwd(), "..", "..");
}

type InstalledRenderEngineRecord = {
  version: string;
  installed_at?: string;
  installedAt?: string;
  install_dir?: string;
  installDir?: string;
  soffice_path?: string;
  sofficePath?: string;
  pdftoppm_path?: string;
  pdftoppmPath?: string;
  python_path?: string | null;
  pythonPath?: string | null;
};

function getInstalledRenderEngineRecordPath(): string {
  return resolve(
    process.env.HOME || "",
    ".alloomi",
    "render-engines",
    "office",
    "installed.json",
  );
}

function readInstalledRenderEngine(): {
  sofficePath: string;
  pdftoppmPath: string;
  pythonPath: string | null;
} | null {
  const recordPath = getInstalledRenderEngineRecordPath();
  if (!existsSync(recordPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      readFileSync(recordPath, "utf-8"),
    ) as InstalledRenderEngineRecord;

    const sofficePath = parsed.soffice_path || parsed.sofficePath;
    const pdftoppmPath = parsed.pdftoppm_path || parsed.pdftoppmPath;
    const pythonPath = parsed.python_path ?? parsed.pythonPath ?? null;

    if (!sofficePath || !pdftoppmPath) {
      return null;
    }

    return {
      sofficePath,
      pdftoppmPath,
      pythonPath,
    };
  } catch {
    return null;
  }
}

function getSofficeScriptPath(): string {
  const repoRoot = getRepoRoot();
  const scriptPath = join(
    repoRoot,
    "skills",
    "pptx",
    "scripts",
    "office",
    "soffice.py",
  );

  if (!existsSync(scriptPath)) {
    throw new Error(`Missing soffice helper script: ${scriptPath}`);
  }

  return scriptPath;
}

function getPythonCommand(): string {
  const installedEngine = readInstalledRenderEngine();
  if (installedEngine?.pythonPath && existsSync(installedEngine.pythonPath)) {
    return installedEngine.pythonPath;
  }

  try {
    execFileSync("python3", ["--version"], { stdio: "ignore" });
    return "python3";
  } catch {
    try {
      execFileSync("python", ["--version"], { stdio: "ignore" });
      return "python";
    } catch {
      throw new Error(
        "Python runtime not found. Install python3 or make `python` available on PATH.",
      );
    }
  }
}

function getRenderPaths(taskId: string, pptxPath: string, stats: Stats) {
  const sessionDir = getTaskSessionDir(taskId);
  const cacheRoot = join(sessionDir, PPTX_RENDER_CACHE_DIR);
  const cacheKey = createHash("sha256")
    .update(`${pptxPath}:${stats.size}:${stats.mtimeMs}`)
    .digest("hex")
    .slice(0, 24);
  const renderDir = join(cacheRoot, cacheKey);
  const manifestPath = join(renderDir, "manifest.json");
  const pdfPath = join(
    renderDir,
    `${basename(pptxPath, extname(pptxPath))}.pdf`,
  );

  return { cacheRoot, cacheKey, renderDir, manifestPath, pdfPath };
}

function getSofficeCommand(): string {
  const installedEngine = readInstalledRenderEngine();
  if (installedEngine?.sofficePath && existsSync(installedEngine.sofficePath)) {
    return installedEngine.sofficePath;
  }

  const explicit = process.env.SOFFICE_BIN;
  if (explicit && existsSync(explicit)) {
    return explicit;
  }

  return "soffice";
}

function getPdftoppmCommand(): string {
  const installedEngine = readInstalledRenderEngine();
  if (
    installedEngine?.pdftoppmPath &&
    existsSync(installedEngine.pdftoppmPath)
  ) {
    return installedEngine.pdftoppmPath;
  }

  const explicit = process.env.PDFTOPPM_BIN;
  if (explicit && existsSync(explicit)) {
    return explicit;
  }

  return "pdftoppm";
}

function isManifestUsable(
  manifest: Partial<PptxRenderManifest>,
  pptxPath: string,
  stats: Stats,
) {
  if (manifest.version !== 1) return false;
  if (manifest.sourcePath !== pptxPath) return false;
  if (manifest.sourceMtimeMs !== stats.mtimeMs) return false;
  if (manifest.sourceSize !== stats.size) return false;
  if (!Array.isArray(manifest.slides) || manifest.slides.length === 0) {
    return false;
  }
  return manifest.slides.every(
    (slide) =>
      typeof slide?.path === "string" && typeof slide?.index === "number",
  );
}

function renderPdfFromPptx(pptxPath: string, outDir: string, pdfPath: string) {
  const scriptPath = getSofficeScriptPath();
  const pythonCommand = getPythonCommand();
  const sofficeCommand = getSofficeCommand();

  try {
    execFileSync(
      pythonCommand,
      [
        scriptPath,
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        outDir,
        "--soffice-bin",
        sofficeCommand,
        pptxPath,
      ],
      { stdio: "pipe" },
    );
  } catch (error) {
    const stderr =
      error &&
      typeof error === "object" &&
      "stderr" in error &&
      error.stderr instanceof Buffer
        ? error.stderr.toString("utf-8").trim()
        : "";
    const stdout =
      error &&
      typeof error === "object" &&
      "stdout" in error &&
      error.stdout instanceof Buffer
        ? error.stdout.toString("utf-8").trim()
        : "";
    const detail = stderr || stdout || "no output";
    throw new Error(`LibreOffice PDF conversion failed: ${detail}`);
  }

  if (!existsSync(pdfPath)) {
    throw new Error("LibreOffice did not produce a preview PDF");
  }
}

function renderSlidesFromPdf(pdfPath: string, renderDir: string) {
  const ppmPrefix = join(renderDir, "slide");
  const pdftoppmCommand = getPdftoppmCommand();
  execFileSync(pdftoppmCommand, ["-png", "-r", "180", pdfPath, ppmPrefix], {
    stdio: "pipe",
  });

  const rawSlides = readdirSync(renderDir)
    .filter((name) => /^slide-\d+\.png$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (rawSlides.length === 0) {
    throw new Error("PDF rasterization produced no slide images");
  }

  return rawSlides;
}

async function optimizeSlides(
  taskId: string,
  renderDir: string,
  rawSlides: string[],
): Promise<PptxRenderedSlide[]> {
  const slides: PptxRenderedSlide[] = [];

  for (let i = 0; i < rawSlides.length; i++) {
    const rawSlideName = rawSlides[i];
    const rawSlidePath = join(renderDir, rawSlideName);
    const optimizedName = `slide-${String(i + 1).padStart(3, "0")}.webp`;
    const optimizedPath = join(renderDir, optimizedName);

    const transformer = sharp(rawSlidePath).rotate().resize({
      width: DEFAULT_SLIDE_WIDTH,
      height: DEFAULT_SLIDE_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    });

    const metadata = await transformer.metadata();
    await transformer.webp({ quality: 88 }).toFile(optimizedPath);

    slides.push({
      index: i,
      path: toSessionRelative(taskId, optimizedPath),
      width: metadata.width ?? DEFAULT_SLIDE_WIDTH,
      height: metadata.height ?? DEFAULT_SLIDE_HEIGHT,
    });
  }

  return slides;
}

export async function getOrCreatePptxRenderManifest(
  taskId: string,
  pptxSourcePath: string,
): Promise<PptxRenderManifest> {
  // Transitional implementation: desktop preview currently routes through the
  // Next/Tauri local server, but the long-term source of truth should be a
  // managed render engine owned by the desktop runtime rather than system PATH.
  const pptxPath = resolvePptxPath(taskId, pptxSourcePath);

  if (!existsSync(pptxPath)) {
    throw new Error("PPTX file not found");
  }

  const stats = statSync(pptxPath);
  if (!stats.isFile()) {
    throw new Error("PPTX path is not a file");
  }

  const { cacheRoot, cacheKey, renderDir, manifestPath, pdfPath } =
    getRenderPaths(taskId, pptxPath, stats);
  ensureDir(cacheRoot);
  ensureDir(renderDir);

  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(
        readFileSync(manifestPath, "utf-8"),
      ) as PptxRenderManifest;
      if (isManifestUsable(manifest, pptxPath, stats)) {
        return manifest;
      }
    } catch {
      // Ignore stale or partial manifest files.
    }
  }

  renderPdfFromPptx(pptxPath, renderDir, pdfPath);
  const rawSlides = renderSlidesFromPdf(pdfPath, renderDir);
  const slides = await optimizeSlides(taskId, renderDir, rawSlides);

  const manifest: PptxRenderManifest = {
    version: 1,
    sourcePath: pptxPath,
    sourceMtimeMs: stats.mtimeMs,
    sourceSize: stats.size,
    cacheKey,
    slideCount: slides.length,
    pdfPath: toSessionRelative(taskId, pdfPath),
    slides,
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  return manifest;
}
