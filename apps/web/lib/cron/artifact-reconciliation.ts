import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import {
  extractArtifactPathsFromText,
  normalizeExtractedArtifactPath,
} from "@/lib/files/extract-artifact-paths";
import type {
  ReasoningFile,
  ReasoningStep,
  StructuredExecutionOutput,
  SuggestedAction,
} from "@/lib/types/execution-result";

export type ArtifactToolPart = {
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  isError?: boolean;
};

type ArtifactCandidate = {
  path: string;
  source: string;
};

export type ArtifactReconciliationResult = {
  structuredData: StructuredExecutionOutput;
  warnings: string[];
};

const OUTPUT_FILE_EXTENSIONS = new Set([
  ".csv",
  ".doc",
  ".docx",
  ".html",
  ".htm",
  ".jpeg",
  ".jpg",
  ".json",
  ".md",
  ".mmark",
  ".pdf",
  ".png",
  ".ppt",
  ".pptx",
  ".svg",
  ".txt",
  ".webp",
  ".xls",
  ".xlsx",
]);

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function expandHome(filePath: string): string {
  if (filePath === "~") return process.env.HOME ?? filePath;
  if (filePath.startsWith("~/")) {
    return join(process.env.HOME ?? "~", filePath.slice(2));
  }
  return filePath;
}

function isProbablyLocalPath(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("~/") ||
    /^[a-zA-Z]:[\\/]/.test(value) ||
    value.startsWith("\\\\")
  );
}

function normalizeCandidatePath(raw: string): string | null {
  const cleaned = normalizeExtractedArtifactPath(raw);
  if (!cleaned) return null;
  const expanded = expandHome(cleaned);
  if (isProbablyLocalPath(expanded)) {
    return resolve(expanded);
  }
  return expanded;
}

function isInsidePath(childPath: string, parentPath: string): boolean {
  const child = resolve(childPath);
  const parent = resolve(parentPath);
  return child === parent || child.startsWith(parent + sep);
}

function hasAllowedOutputExtension(filePath: string): boolean {
  return OUTPUT_FILE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function uniqueTargetPath(sessionDir: string, fileName: string): string {
  const parsedExt = extname(fileName);
  const stem = parsedExt ? fileName.slice(0, -parsedExt.length) : fileName;
  let candidate = join(sessionDir, fileName);
  let index = 1;

  while (existsSync(candidate)) {
    candidate = join(sessionDir, `${stem}-${index}${parsedExt}`);
    index += 1;
  }

  return candidate;
}

function pathBelongsToExecution(
  filePath: string,
  sessionsRoot: string,
  executionId: string,
): boolean {
  const resolved = resolve(filePath);
  const root = resolve(sessionsRoot);
  if (!isInsidePath(resolved, root)) return false;

  const segments = resolved.slice(root.length).split(/[\\/]/).filter(Boolean);
  return segments.includes(executionId);
}

function addCandidate(
  candidates: ArtifactCandidate[],
  seen: Set<string>,
  path: unknown,
  source: string,
) {
  if (typeof path !== "string") return;
  const normalized = normalizeCandidatePath(path);
  if (!normalized) return;
  if (!hasAllowedOutputExtension(normalized)) return;
  if (seen.has(normalized)) return;
  seen.add(normalized);
  candidates.push({ path: normalized, source });
}

function addCandidatesFromText(
  candidates: ArtifactCandidate[],
  seen: Set<string>,
  text: unknown,
  source: string,
) {
  const value = stringify(text);
  if (!value) return;
  for (const filePath of extractArtifactPathsFromText(value)) {
    addCandidate(candidates, seen, filePath, source);
  }
}

function addCandidatesFromToolInput(
  candidates: ArtifactCandidate[],
  seen: Set<string>,
  input: unknown,
  source: string,
) {
  if (!input || typeof input !== "object") return;
  const record = input as Record<string, unknown>;

  for (const key of ["file_path", "filePath", "path", "absolutePath"]) {
    addCandidate(candidates, seen, record[key], `${source}.${key}`);
  }

  addCandidatesFromText(candidates, seen, record.command, `${source}.command`);
}

function addCandidatesFromFiles(
  candidates: ArtifactCandidate[],
  seen: Set<string>,
  files: ReasoningFile[] | undefined,
  source: string,
) {
  for (const file of files ?? []) {
    addCandidate(candidates, seen, file.path, source);
  }
}

function addCandidatesFromActions(
  candidates: ArtifactCandidate[],
  seen: Set<string>,
  actions: SuggestedAction[] | undefined,
  source: string,
) {
  for (const action of actions ?? []) {
    if (action.type !== "open_file" && action.type !== "download_file") {
      continue;
    }
    addCandidate(candidates, seen, action.params?.path, source);
    addCandidate(candidates, seen, action.content, source);
  }
}

function collectArtifactCandidates(input: {
  toolParts: ArtifactToolPart[];
  finalText: string;
  structuredData: StructuredExecutionOutput;
}): ArtifactCandidate[] {
  const candidates: ArtifactCandidate[] = [];
  const seen = new Set<string>();

  for (const [index, part] of input.toolParts.entries()) {
    const source = `tool.${part.toolName ?? "unknown"}.${index}`;
    addCandidatesFromToolInput(candidates, seen, part.toolInput, source);
    addCandidatesFromText(
      candidates,
      seen,
      part.toolOutput,
      `${source}.output`,
    );
  }

  addCandidatesFromText(candidates, seen, input.finalText, "final_text");
  addCandidatesFromFiles(candidates, seen, input.structuredData.files, "files");

  for (const [index, step] of (
    input.structuredData.reasoningChain ?? []
  ).entries()) {
    addCandidatesFromFiles(candidates, seen, step.files, `step.${index}.files`);
  }

  addCandidatesFromActions(
    candidates,
    seen,
    input.structuredData.suggestedActions,
    "suggested_actions",
  );

  return candidates;
}

function reconcileCandidate(input: {
  candidate: ArtifactCandidate;
  sessionDir: string;
  sessionsRoot: string;
  executionId: string;
  pathMap: Map<string, string>;
  warnings: string[];
}) {
  const {
    candidate,
    sessionDir,
    sessionsRoot,
    executionId,
    pathMap,
    warnings,
  } = input;
  const sourcePath = resolve(candidate.path);

  if (!existsSync(sourcePath)) {
    warnings.push(`artifact_missing:${candidate.source}:${candidate.path}`);
    return;
  }

  const stats = statSync(sourcePath);
  if (!stats.isFile()) {
    warnings.push(`artifact_not_file:${candidate.source}:${candidate.path}`);
    return;
  }

  if (!hasAllowedOutputExtension(sourcePath)) {
    warnings.push(
      `artifact_unsupported_type:${candidate.source}:${candidate.path}`,
    );
    return;
  }

  if (isInsidePath(sourcePath, sessionDir)) {
    pathMap.set(candidate.path, sourcePath);
    pathMap.set(sourcePath, sourcePath);
    return;
  }

  if (!pathBelongsToExecution(sourcePath, sessionsRoot, executionId)) {
    warnings.push(
      `artifact_outside_execution:${candidate.source}:${candidate.path}`,
    );
    return;
  }

  mkdirSync(sessionDir, { recursive: true });
  const targetPath = uniqueTargetPath(sessionDir, basename(sourcePath));

  try {
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
    pathMap.set(candidate.path, targetPath);
    pathMap.set(sourcePath, targetPath);
    warnings.push(`artifact_rehomed:${candidate.source}:${sourcePath}`);
  } catch (error) {
    warnings.push(
      `artifact_rehome_failed:${candidate.source}:${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function resolveKnownArtifactPath(
  rawPath: string | undefined,
  pathMap: Map<string, string>,
  sessionDir: string,
): string | undefined {
  if (!rawPath) return undefined;
  const normalized = normalizeCandidatePath(rawPath);
  if (!normalized) return undefined;

  const mapped = pathMap.get(normalized) ?? pathMap.get(rawPath);
  if (mapped) return mapped;

  if (existsSync(normalized) && isInsidePath(normalized, sessionDir)) {
    return resolve(normalized);
  }

  return undefined;
}

function cleanFiles(
  files: ReasoningFile[] | undefined,
  pathMap: Map<string, string>,
  sessionDir: string,
): ReasoningFile[] | undefined {
  const out: ReasoningFile[] = [];

  for (const file of files ?? []) {
    if (!file.path) {
      if (file.url) out.push(file);
      continue;
    }

    const canonicalPath = resolveKnownArtifactPath(
      file.path,
      pathMap,
      sessionDir,
    );
    if (!canonicalPath) continue;

    const name = file.name?.trim() || basename(canonicalPath);
    out.push({
      ...file,
      name,
      path: canonicalPath,
      type: file.type?.trim() || extname(name).replace(".", "") || undefined,
      role: file.role ?? "output",
    });
  }

  return out.length > 0 ? out : undefined;
}

function cleanSteps(
  steps: ReasoningStep[] | undefined,
  pathMap: Map<string, string>,
  sessionDir: string,
): ReasoningStep[] | undefined {
  if (!steps) return undefined;

  return steps.map((step) => ({
    ...step,
    files: cleanFiles(step.files, pathMap, sessionDir),
  }));
}

function cleanActions(
  actions: SuggestedAction[] | undefined,
  pathMap: Map<string, string>,
  sessionDir: string,
): SuggestedAction[] | undefined {
  const out: SuggestedAction[] = [];

  for (const action of actions ?? []) {
    if (action.type !== "open_file" && action.type !== "download_file") {
      out.push(action);
      continue;
    }

    const rawPath =
      typeof action.params?.path === "string"
        ? action.params.path
        : action.content;
    const canonicalPath = resolveKnownArtifactPath(
      rawPath,
      pathMap,
      sessionDir,
    );
    if (!canonicalPath) continue;

    const name =
      typeof action.params?.name === "string" && action.params.name.trim()
        ? action.params.name.trim()
        : basename(canonicalPath);
    const type =
      typeof action.params?.type === "string" && action.params.type.trim()
        ? action.params.type.trim()
        : extname(name).replace(".", "");

    out.push({
      ...action,
      content: canonicalPath,
      params: {
        ...(action.params ?? {}),
        path: canonicalPath,
        name,
        type,
      },
    });
  }

  return out.length > 0 ? out : undefined;
}

export function reconcileExecutionArtifacts(input: {
  sessionDir: string;
  sessionsRoot: string;
  executionId: string;
  toolParts: ArtifactToolPart[];
  finalText: string;
  structuredData: StructuredExecutionOutput;
}): ArtifactReconciliationResult {
  const sessionDir = resolve(input.sessionDir);
  const sessionsRoot = resolve(input.sessionsRoot);
  const warnings: string[] = [];
  const pathMap = new Map<string, string>();
  const candidates = collectArtifactCandidates(input);

  for (const candidate of candidates) {
    reconcileCandidate({
      candidate,
      sessionDir,
      sessionsRoot,
      executionId: input.executionId,
      pathMap,
      warnings,
    });
  }

  const structuredWarnings = input.structuredData.diagnostics?.warnings ?? [];

  return {
    structuredData: {
      ...input.structuredData,
      files: cleanFiles(input.structuredData.files, pathMap, sessionDir),
      reasoningChain: cleanSteps(
        input.structuredData.reasoningChain,
        pathMap,
        sessionDir,
      ),
      suggestedActions: cleanActions(
        input.structuredData.suggestedActions,
        pathMap,
        sessionDir,
      ),
      diagnostics:
        structuredWarnings.length > 0 || warnings.length > 0
          ? {
              source: input.structuredData.diagnostics?.source ?? "repaired",
              warnings: [...structuredWarnings, ...warnings],
            }
          : input.structuredData.diagnostics,
    },
    warnings,
  };
}
