/**
 * Markdown → Telegram HTML converter.
 *
 * Architecture (from OpenClaw):
 *   1. Parse markdown with markdown-it → token stream
 *   2. Convert tokens to an IR: { text, styles: [{start,end,style}], links: [{start,end,href}] }
 *   3. Render IR → Telegram HTML using a boundary-based stack
 *
 * This approach properly handles overlapping styles (e.g. **bold [link](url)**)
 * by ranking styles and rendering from outermost to innermost.
 */

import MarkdownIt from "markdown-it";

// Minimal Token interface matching markdown-it's Token class
interface Token {
  type: string;
  tag: string;
  content: string;
  children: Token[] | null;
  attrs?: [string, string][];
  attrGet?: (name: string) => string | null;
}

// ─── IR types ────────────────────────────────────────────────────────────────

interface StyleSpan {
  start: number;
  end: number;
  style:
    | "bold"
    | "italic"
    | "strikethrough"
    | "code"
    | "code_block"
    | "blockquote"
    | "spoiler";
}

interface LinkSpan {
  start: number;
  end: number;
  href: string;
}

interface MarkdownIR {
  text: string;
  styles: StyleSpan[];
  links: LinkSpan[];
}

// ─── markdown-it setup ────────────────────────────────────────────────────────

function createMarkdownIt(): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false,
    typographer: false,
  });
  md.enable("strikethrough");
  md.enable("table");
  return md;
}

// ─── Token → IR conversion ──────────────────────────────────────────────────

interface ListEntry {
  type: "bullet" | "ordered";
  index: number;
}

interface TableCellIR {
  text: string;
  styles: StyleSpan[];
  links: LinkSpan[];
}

interface TableIR {
  headers: TableCellIR[];
  rows: TableCellIR[][];
  currentRow: TableCellIR[];
  currentCell: {
    text: string;
    styles: StyleSpan[];
    links: LinkSpan[];
    openStyles: { style: StyleSpan["style"]; start: number }[];
    linkStack: { href: string; labelStart: number }[];
  } | null;
  inHeader: boolean;
}

interface RenderState {
  text: string;
  styles: StyleSpan[];
  openStyles: { style: StyleSpan["style"]; start: number }[];
  links: LinkSpan[];
  linkStack: { href: string; labelStart: number }[];
  listStack: ListEntry[];
  headingStyle: "none" | "bold";
  blockquotePrefix: string;
  table: TableIR | null;
  tableMode: "off" | "bullets" | "code";
  spoilerEnabled: boolean;
}

function initCellState(): {
  text: string;
  styles: StyleSpan[];
  openStyles: { style: StyleSpan["style"]; start: number }[];
  links: LinkSpan[];
  linkStack: { href: string; labelStart: number }[];
} {
  return {
    text: "",
    styles: [],
    openStyles: [],
    links: [],
    linkStack: [],
  };
}

function finishCell(cell: ReturnType<typeof initCellState>): TableCellIR {
  closeRemainingStyles(cell);
  return { text: cell.text, styles: cell.styles, links: cell.links };
}

function resolveTarget(state: RenderState) {
  return state.table?.currentCell ?? state;
}

function appendText(state: RenderState, value: string): void {
  if (!value) return;
  resolveTarget(state).text += value;
}

function openStyle(state: RenderState, style: StyleSpan["style"]): void {
  const target = resolveTarget(state);
  target.openStyles.push({ style, start: target.text.length });
}

function closeStyle(state: RenderState, style: StyleSpan["style"]): void {
  const target = resolveTarget(state);
  for (let i = target.openStyles.length - 1; i >= 0; i--) {
    if (target.openStyles[i]?.style === style) {
      const start = target.openStyles[i].start;
      target.openStyles.splice(i, 1);
      const end = target.text.length;
      if (end > start) {
        target.styles.push({ start, end, style });
      }
      return;
    }
  }
}

function closeRemainingStyles(target: ReturnType<typeof initCellState>): void {
  for (let i = target.openStyles.length - 1; i >= 0; i--) {
    const open = target.openStyles[i];
    const end = target.text.length;
    if (end > open.start) {
      target.styles.push({ start: open.start, end, style: open.style });
    }
  }
  target.openStyles = [];
}

function getAttr(token: Token, name: string): string | null {
  if (token.attrGet) return token.attrGet(name);
  if (token.attrs) {
    for (const [key, value] of token.attrs) {
      if (key === name) return value;
    }
  }
  return null;
}

function renderTableAsBullets(state: RenderState): void {
  if (!state.table) return;

  const headers = state.table.headers;
  const rows = state.table.rows;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    if (row.length === 0) continue;

    // First cell as bold label
    const labelStart = state.text.length;
    state.text += row[0].text;
    if (state.text.length > labelStart) {
      state.styles.push({
        start: labelStart,
        end: state.text.length,
        style: "bold",
      });
    }
    state.text += "\n";

    for (let ci = 1; ci < row.length; ci++) {
      const headerText = headers[ci]?.text ?? `Column ${ci}`;
      state.text += "• ";
      state.text += `${headerText}: `;
      state.text += `${row[ci].text}\n`;
    }
  }
}

function renderTableAsCode(state: RenderState): void {
  if (!state.table) return;

  const headers = state.table.headers;
  const rows = state.table.rows;
  const colCount = Math.max(headers.length, ...rows.map((r) => r.length));
  if (colCount === 0) return;

  const widths = Array.from({ length: colCount }, () => 0);
  const updateWidths = (cells: TableCellIR[]) => {
    for (let i = 0; i < colCount; i++) {
      widths[i] = Math.max(widths[i], cells[i]?.text.length ?? 0);
    }
  };
  updateWidths(headers);
  for (const row of rows) updateWidths(row);

  const codeStart = state.text.length;

  const appendRow = (cells: TableCellIR[]) => {
    state.text += "|";
    for (let i = 0; i < colCount; i++) {
      state.text += " ";
      const cell = cells[i];
      state.text += cell ? cell.text : "";
      const pad = widths[i] - (cell?.text.length ?? 0);
      state.text += `${" ".repeat(Math.max(0, pad))} |`;
    }
    state.text += "\n";
  };

  const appendDivider = () => {
    state.text += "|";
    for (let i = 0; i < colCount; i++) {
      state.text += ` ${"-".repeat(Math.max(3, widths[i]))} |`;
    }
    state.text += "\n";
  };

  appendRow(headers);
  appendDivider();
  for (const row of rows) appendRow(row);

  const codeEnd = state.text.length;
  if (codeEnd > codeStart) {
    state.styles.push({ start: codeStart, end: codeEnd, style: "code_block" });
  }
}

function processTokens(tokens: Token[], state: RenderState): void {
  for (const token of tokens) {
    switch (token.type) {
      case "inline":
        if (token.children) processTokens(token.children, state);
        break;

      case "text":
        appendText(state, token.content ?? "");
        break;

      case "em_open":
        openStyle(state, "italic");
        break;
      case "em_close":
        closeStyle(state, "italic");
        break;

      case "strong_open":
        openStyle(state, "bold");
        break;
      case "strong_close":
        closeStyle(state, "bold");
        break;

      case "s_open":
        openStyle(state, "strikethrough");
        break;
      case "s_close":
        closeStyle(state, "strikethrough");
        break;

      case "spoiler_open":
        if (state.spoilerEnabled) openStyle(state, "spoiler");
        break;
      case "spoiler_close":
        if (state.spoilerEnabled) closeStyle(state, "spoiler");
        break;

      case "code_inline": {
        const content = token.content ?? "";
        const target = resolveTarget(state);
        const start = target.text.length;
        target.text += content;
        target.styles.push({
          start,
          end: start + content.length,
          style: "code",
        });
        break;
      }

      case "link_open": {
        const href = getAttr(token, "href") ?? "";
        const target = resolveTarget(state);
        target.linkStack.push({ href, labelStart: target.text.length });
        break;
      }
      case "link_close": {
        const target = resolveTarget(state);
        const link = target.linkStack.pop();
        if (link?.href) {
          const href = link.href.trim();
          if (href) {
            target.links.push({
              start: link.labelStart,
              end: target.text.length,
              href,
            });
          }
        }
        break;
      }

      case "image":
        appendText(state, token.content ?? "");
        break;

      case "softbreak":
      case "hardbreak":
        appendText(state, "\n");
        break;

      case "paragraph_close": {
        if (state.listStack.length === 0 && !state.table) {
          state.text += "\n\n";
        }
        break;
      }

      case "heading_open":
        if (state.headingStyle === "bold") openStyle(state, "bold");
        break;
      case "heading_close":
        if (state.headingStyle === "bold") closeStyle(state, "bold");
        if (state.listStack.length === 0 && !state.table) state.text += "\n\n";
        break;

      case "blockquote_open":
        if (state.blockquotePrefix) state.text += state.blockquotePrefix;
        openStyle(state, "blockquote");
        break;
      case "blockquote_close":
        closeStyle(state, "blockquote");
        break;

      case "bullet_list_open":
        if (state.listStack.length > 0) state.text += "\n";
        state.listStack.push({ type: "bullet", index: 0 });
        break;
      case "bullet_list_close":
        state.listStack.pop();
        if (state.listStack.length === 0) state.text += "\n";
        break;

      case "ordered_list_open": {
        if (state.listStack.length > 0) state.text += "\n";
        const start = Number(getAttr(token, "start") ?? "1");
        state.listStack.push({ type: "ordered", index: start - 1 });
        break;
      }
      case "ordered_list_close":
        state.listStack.pop();
        if (state.listStack.length === 0) state.text += "\n";
        break;

      case "list_item_open": {
        const top = state.listStack[state.listStack.length - 1];
        if (top) {
          top.index++;
          const indent = "  ".repeat(Math.max(0, state.listStack.length - 1));
          const prefix = top.type === "ordered" ? `${top.index}. ` : "• ";
          state.text += `${indent}${prefix}`;
        }
        break;
      }

      case "list_item_close":
        if (!state.text.endsWith("\n")) state.text += "\n";
        break;

      case "code_block":
      case "fence": {
        let code = token.content ?? "";
        if (!code.endsWith("\n")) code += "\n";
        const target = resolveTarget(state);
        const start = target.text.length;
        target.text += code;
        target.styles.push({
          start,
          end: start + code.length,
          style: "code_block",
        });
        if (state.listStack.length === 0) target.text += "\n";
        break;
      }

      case "html_block":
      case "html_inline":
        appendText(state, token.content ?? "");
        break;

      case "table_open":
        if (state.tableMode !== "off") {
          state.table = {
            headers: [],
            rows: [],
            currentRow: [],
            currentCell: null,
            inHeader: false,
          };
        }
        break;

      case "table_close":
        if (state.table) {
          if (state.tableMode === "bullets") renderTableAsBullets(state);
          else if (state.tableMode === "code") renderTableAsCode(state);
        }
        state.table = null;
        break;

      case "thead_open":
        if (state.table) state.table.inHeader = true;
        break;
      case "thead_close":
        if (state.table) state.table.inHeader = false;
        break;

      case "tbody_open":
      case "tbody_close":
        break;

      case "tr_open":
        if (state.table) state.table.currentRow = [];
        break;
      case "tr_close":
        if (state.table) {
          if (state.table.inHeader) {
            state.table.headers = state.table.currentRow;
          } else {
            state.table.rows.push(state.table.currentRow);
          }
          state.table.currentRow = [];
        }
        break;

      case "th_open":
      case "td_open":
        if (state.table) state.table.currentCell = initCellState();
        break;
      case "th_close":
      case "td_close":
        if (state.table?.currentCell) {
          state.table.currentRow.push(finishCell(state.table.currentCell));
          state.table.currentCell = null;
        }
        break;

      case "hr":
        state.text += "───\n\n";
        break;

      default:
        if (token.children) processTokens(token.children, state);
        break;
    }
  }
}

function markdownToIR(
  markdown: string,
  options: {
    linkify?: boolean;
    enableSpoilers?: boolean;
    headingStyle?: "none" | "bold";
    blockquotePrefix?: string;
    tableMode?: "off" | "bullets" | "code";
  } = {},
): MarkdownIR {
  const md = createMarkdownIt();

  const env = { listStack: [] as ListEntry[] };
  const tokens = md.parse(markdown ?? "", env);

  const state: RenderState = {
    text: "",
    styles: [],
    openStyles: [],
    links: [],
    linkStack: [],
    listStack: [],
    headingStyle: options.headingStyle ?? "none",
    blockquotePrefix: options.blockquotePrefix ?? "",
    table: null,
    tableMode: options.tableMode ?? "code",
    spoilerEnabled: options.enableSpoilers ?? true,
  };

  processTokens(tokens as Token[], state);
  closeRemainingStyles(resolveTarget(state));

  const trimmedLen = state.text.trimEnd().length;
  let codeBlockEnd = 0;
  for (const span of state.styles) {
    if (span.style !== "code_block") continue;
    if (span.end > codeBlockEnd) codeBlockEnd = span.end;
  }
  const finalLen = Math.max(trimmedLen, codeBlockEnd);

  return {
    text:
      finalLen === state.text.length
        ? state.text
        : state.text.slice(0, finalLen),
    styles: mergeStyleSpans(clampStyleSpans(state.styles, finalLen)),
    links: clampLinkSpans(state.links, finalLen),
  };
}

function clampStyleSpans(spans: StyleSpan[], maxLen: number): StyleSpan[] {
  return spans
    .map((s) => ({
      ...s,
      start: Math.max(0, Math.min(s.start, maxLen)),
      end: Math.max(0, Math.min(s.end, maxLen)),
    }))
    .filter((s) => s.end > s.start);
}

function clampLinkSpans(spans: LinkSpan[], maxLen: number): LinkSpan[] {
  return spans
    .map((s) => ({
      ...s,
      start: Math.max(0, Math.min(s.start, maxLen)),
      end: Math.max(0, Math.min(s.end, maxLen)),
    }))
    .filter((s) => s.end > s.start);
}

function mergeStyleSpans(spans: StyleSpan[]): StyleSpan[] {
  if (spans.length === 0) return [];
  const sorted = [...spans].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.end !== b.end) return b.end - a.end;
    return a.style.localeCompare(b.style);
  });
  const merged: StyleSpan[] = [];
  for (const s of sorted) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.style === s.style &&
      (s.start < prev.end || (s.start === prev.end && s.style !== "blockquote"))
    ) {
      prev.end = Math.max(prev.end, s.end);
      continue;
    }
    merged.push({ ...s });
  }
  return merged;
}

// ─── IR → Telegram HTML rendering ───────────────────────────────────────────

const STYLE_RANK = new Map<StyleSpan["style"], number>([
  ["blockquote", 0],
  ["code_block", 1],
  ["code", 2],
  ["bold", 3],
  ["italic", 4],
  ["strikethrough", 5],
  ["spoiler", 6],
]);

function sortStyleSpans(spans: StyleSpan[]): StyleSpan[] {
  return [...spans].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.end !== b.end) return b.end - a.end;
    return (STYLE_RANK.get(a.style) ?? 0) - (STYLE_RANK.get(b.style) ?? 0);
  });
}

interface RenderLinkResult {
  start: number;
  end: number;
  open: string;
  close: string;
}

function renderMarkdownWithMarkers(
  ir: MarkdownIR,
  options: {
    styleMarkers: Record<string, { open: string; close: string }>;
    escapeText: (text: string) => string;
    buildLink?: (link: LinkSpan, text: string) => RenderLinkResult | null;
  },
): string {
  const { escapeText: escFn, styleMarkers: markers, buildLink } = options;
  const content = ir.text;
  if (!content) return "";

  const styled = sortStyleSpans(
    ir.styles.filter((s) => Boolean(markers[s.style])),
  );

  const boundaries = new Set<number>();
  boundaries.add(0);
  boundaries.add(content.length);

  const startsAt = new Map<number, StyleSpan[]>();
  for (const span of styled) {
    if (span.start === span.end) continue;
    boundaries.add(span.start);
    boundaries.add(span.end);
    const bucket = startsAt.get(span.start);
    if (bucket) bucket.push(span);
    else startsAt.set(span.start, [span]);
  }

  for (const spans of startsAt.values()) {
    spans.sort((a, b) => {
      if (a.end !== b.end) return b.end - a.end;
      return (STYLE_RANK.get(a.style) ?? 0) - (STYLE_RANK.get(b.style) ?? 0);
    });
  }

  const linkStarts = new Map<number, RenderLinkResult[]>();
  if (buildLink) {
    for (const link of ir.links) {
      if (link.start === link.end) continue;
      const rendered = buildLink(link, content);
      if (!rendered) continue;
      boundaries.add(rendered.start);
      boundaries.add(rendered.end);
      const bucket = linkStarts.get(rendered.start);
      if (bucket) bucket.push(rendered);
      else linkStarts.set(rendered.start, [rendered]);
    }
  }

  const points = [...boundaries].sort((a, b) => a - b);
  const stack: { close: string; end: number }[] = [];
  let out = "";

  for (let i = 0; i < points.length; i++) {
    const pos = points[i];

    while (stack.length && stack[stack.length - 1]?.end === pos) {
      const item = stack.pop();
      if (item) out += item.close;
    }

    const openingItems: {
      end: number;
      open: string;
      close: string;
      kind: "link" | "style";
      style?: StyleSpan["style"];
      index: number;
    }[] = [];

    const openingLinks = linkStarts.get(pos);
    if (openingLinks) {
      for (let idx = 0; idx < openingLinks.length; idx++) {
        const l = openingLinks[idx];
        openingItems.push({
          end: l.end,
          open: l.open,
          close: l.close,
          kind: "link",
          index: idx,
        });
      }
    }

    const openingStyles = startsAt.get(pos);
    if (openingStyles) {
      for (let idx = 0; idx < openingStyles.length; idx++) {
        const span = openingStyles[idx];
        const marker = markers[span.style];
        if (!marker) continue;
        openingItems.push({
          end: span.end,
          open: marker.open,
          close: marker.close,
          kind: "style",
          style: span.style,
          index: idx,
        });
      }
    }

    if (openingItems.length > 0) {
      openingItems.sort((a, b) => {
        if (a.end !== b.end) return b.end - a.end;
        if (a.kind !== b.kind) return a.kind === "link" ? -1 : 1;
        if (a.kind === "style" && b.kind === "style") {
          return (
            (STYLE_RANK.get(a.style ?? "bold") ?? 0) -
            (STYLE_RANK.get(b.style ?? "bold") ?? 0)
          );
        }
        return a.index - b.index;
      });
      for (const item of openingItems) {
        out += item.open;
        stack.push({ close: item.close, end: item.end });
      }
    }

    const next = points[i + 1];
    if (next === undefined) break;
    if (next > pos) out += escFn(content.slice(pos, next));
  }

  return out;
}

// ─── Public API ──────────────────────────────────────────────────────────────

const TELEGRAM_STYLE_MARKERS: Record<string, { open: string; close: string }> =
  {
    bold: { open: "<b>", close: "</b>" },
    italic: { open: "<i>", close: "</i>" },
    strikethrough: { open: "<s>", close: "</s>" },
    code: { open: "<code>", close: "</code>" },
    code_block: { open: "<pre><code>", close: "</code></pre>" },
    spoiler: { open: "<tg-spoiler>", close: "</tg-spoiler>" },
    blockquote: { open: "<blockquote>", close: "</blockquote>" },
  };

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

function buildTelegramLink(
  link: LinkSpan,
  text: string,
): RenderLinkResult | null {
  const href = link.href.trim();
  if (!href || link.start === link.end) return null;
  return {
    start: link.start,
    end: link.end,
    open: `<a href="${escapeHtmlAttr(href)}">`,
    close: "</a>",
  };
}

export function markdownToTelegramHtml(markdown: string): string {
  if (!markdown?.trim()) return "";

  try {
    const ir = markdownToIR(markdown, {
      linkify: true,
      enableSpoilers: true,
      headingStyle: "none",
      blockquotePrefix: "",
      tableMode: "code",
    });

    return renderMarkdownWithMarkers(ir, {
      styleMarkers: TELEGRAM_STYLE_MARKERS,
      escapeText: escapeHtml,
      buildLink: buildTelegramLink,
    });
  } catch (err) {
    console.error(
      "[Telegram Markdown] Conversion failed, falling back to plain text:",
      err,
    );
    // Fallback: escape HTML chars so the raw markdown is at least readable
    return escapeHtml(markdown);
  }
}
