/**
 * Parse CSV text or Excel/ODS binary into a small table snapshot for library grid cards
 * (first worksheet, limited rows and columns).
 */

const MAX_SNAPSHOT_ROWS = 8;
const MAX_SNAPSHOT_COLS = 10;
const MAX_CELL_CHARS = 24;

/** Table snapshot: used by {@link LibraryGridPreviewPane} and other components for rendering */
export interface LibrarySpreadsheetSnapshot {
  /** Name of the currently displayed worksheet (CSV always defaults to Sheet1) */
  sheetName: string;
  /** 2D text grid with cells truncated and content clipped */
  grid: string[][];
}

/**
 * Compress cell content into a single line with length limit to prevent snapshot from breaking layout.
 */
function normalizeCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  const oneLine = s.replace(/\s+/g, " ").trim();
  if (oneLine.length <= MAX_CELL_CHARS) return oneLine;
  return `${oneLine.slice(0, MAX_CELL_CHARS)}…`;
}

/**
 * Clamp grid to row and column limits.
 */
function clampGrid(raw: string[][]): string[][] {
  return raw
    .slice(0, MAX_SNAPSHOT_ROWS)
    .map((row) => row.slice(0, MAX_SNAPSHOT_COLS).map((c) => normalizeCell(c)));
}

/**
 * Convert CSV text to grid using Papa Parse.
 */
async function gridFromCsvText(text: string): Promise<string[][] | null> {
  const Papa = (await import("papaparse")).default;
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
  });
  const rows = (result.data as string[][]).filter((r) =>
    r.some((c) => c != null && String(c).trim().length > 0),
  );
  if (rows.length === 0) return null;
  return clampGrid(rows);
}

/**
 * Parse the first worksheet into grid using SheetJS.
 */
async function gridFromWorkbookBytes(
  bytes: Uint8Array,
): Promise<{ name: string; grid: string[][] } | null> {
  const XLSX = await import("xlsx");
  let wb: ReturnType<typeof XLSX.read>;
  try {
    wb = XLSX.read(bytes, { type: "array" });
  } catch {
    return null;
  }
  const firstName = wb.SheetNames[0];
  if (!firstName) return null;
  const sheet = wb.Sheets[firstName];
  const json = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
  }) as string[][];
  if (!json.length) return null;
  return { name: firstName, grid: clampGrid(json) };
}

export type LibrarySpreadsheetInput =
  | { mode: "utf8"; text: string }
  | { mode: "bytes"; bytes: Uint8Array };

/**
 * Build table snapshot from extension and text/binary input; returns null on parse failure.
 */
export async function buildLibrarySpreadsheetSnapshot(
  extLower: string,
  input: LibrarySpreadsheetInput,
): Promise<LibrarySpreadsheetSnapshot | null> {
  const e = extLower.toLowerCase().replace(/^\./, "");

  if (e === "csv") {
    const text =
      input.mode === "utf8"
        ? input.text
        : new TextDecoder("utf-8", { fatal: false }).decode(input.bytes);
    const grid = await gridFromCsvText(text);
    if (!grid?.length) return null;
    return { sheetName: "Sheet1", grid };
  }

  if (input.mode === "utf8") {
    return null;
  }

  const parsed = await gridFromWorkbookBytes(input.bytes);
  if (!parsed?.grid.length) return null;
  return { sheetName: parsed.name, grid: parsed.grid };
}
