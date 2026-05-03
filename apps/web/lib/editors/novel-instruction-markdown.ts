import TurndownService from "turndown";

/**
 * Escape HTML entities to safely embed text into basic HTML.
 *
 * @param value Raw string
 * @returns Escaped string
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape HTML attribute value to safely embed into HTML attributes.
 */
function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Inline renderer for event/skill/source tokens:
 * - event: [[ref:event:id|title]] (optionally followed by spaces)
 * - source: [[ref:file:id|name]] / [[ref:folder:id|name]]
 * - skill: /skill-xxx (followed by spaces)
 *
 * This is used to build the tiptap HTML representation from stored markdown.
 */
export function renderInlineBadges(
  text: string,
  skillNameById: Record<string, string>,
): string {
  const eventRe = /\[\[ref:event:([^\]]*)\]\]\s*/g;
  const sourceRe = /\[\[ref:(file|folder):([^\]|]+)\|([^\]]+)\]\]\s*/g;
  const skillRe = /\/([\w-]+)(?=\s|$|\/)/g;

  const parts: string[] = [];
  let cursor = 0;

  let eMatch = eventRe.exec(text);
  let sMatch = skillRe.exec(text);
  let fMatch = sourceRe.exec(text);

  const pushEscaped = (chunk: string) => {
    if (!chunk) return;
    parts.push(escapeHtml(chunk));
  };

  while (eMatch || sMatch || fMatch) {
    const eventIndex = eMatch ? eMatch.index : Number.POSITIVE_INFINITY;
    const skillIndex = sMatch ? sMatch.index : Number.POSITIVE_INFINITY;
    const sourceIndex = fMatch ? fMatch.index : Number.POSITIVE_INFINITY;
    const earliest = Math.min(eventIndex, skillIndex, sourceIndex);
    const nextType =
      earliest === eventIndex
        ? "event"
        : earliest === sourceIndex
          ? "source"
          : "skill";
    const match =
      nextType === "event" ? eMatch : nextType === "source" ? fMatch : sMatch;
    if (!match) break;

    if (match.index > cursor) {
      pushEscaped(text.slice(cursor, match.index));
    }

    if (nextType === "event") {
      const full = match[0] ?? "";
      const label = match[1] ?? "";
      const [idRaw, ...rest] = label.split("|");
      const eventId = (idRaw ?? "").trim();
      const title = (rest.join("|") ?? "").trim() || eventId;

      const marker = full.trimEnd();
      parts.push(
        `<span data-badge-kind="event" data-badge-id="${escapeHtmlAttribute(
          eventId,
        )}" data-badge-label="${escapeHtmlAttribute(title)}" data-badge-marker="${escapeHtmlAttribute(
          marker,
        )}" class="inline-flex items-center justify-start min-h-5 gap-1 rounded-[6px] border border-border/70 bg-surface px-1.5 py-0.5 text-xs font-medium text-foreground max-w-[140px] min-w-0 mr-1 overflow-hidden group" contenteditable="false"><i class="ri-radar-line"></i><span class="flex-1 min-w-0 truncate whitespace-nowrap">${escapeHtml(
          title,
        )}</span><button type="button" data-badge-remove="true" data-badge-marker="${escapeHtmlAttribute(
          marker,
        )}" aria-label="Remove" class="ml-0 inline-flex h-4 w-0 shrink-0 items-center justify-center overflow-hidden rounded-[4px] text-[12px] leading-none text-muted-foreground/70 hover:text-foreground hover:bg-border/70 opacity-0 group-hover:ml-1 group-hover:w-4 group-hover:opacity-100 transition-all">x</button></span>`,
      );
    } else if (nextType === "source") {
      const full = match[0] ?? "";
      const sourceKind = ((match[1] as string) ?? "file").trim();
      const sourceId = ((match[2] as string) ?? "").trim();
      const sourceLabel = ((match[3] as string) ?? sourceId).trim();
      const marker = full.trimEnd();
      parts.push(
        `<span data-badge-kind="${escapeHtmlAttribute(
          sourceKind,
        )}" data-badge-id="${escapeHtmlAttribute(
          sourceId,
        )}" data-badge-label="${escapeHtmlAttribute(sourceLabel)}" data-badge-marker="${escapeHtmlAttribute(
          marker,
        )}" class="inline-flex items-center justify-start min-h-5 gap-1 rounded-[6px] border border-border/70 bg-surface px-1.5 py-0.5 text-xs font-medium text-foreground max-w-[140px] min-w-0 mr-1 overflow-hidden group" contenteditable="false"><i class="${sourceKind === "folder" ? "ri-folder-line" : "ri-file-line"}"></i><span class="flex-1 min-w-0 truncate whitespace-nowrap">${escapeHtml(
          sourceLabel,
        )}</span><button type="button" data-badge-remove="true" data-badge-marker="${escapeHtmlAttribute(
          marker,
        )}" aria-label="Remove" class="ml-0 inline-flex h-4 w-0 shrink-0 items-center justify-center overflow-hidden rounded-[4px] text-[12px] leading-none text-muted-foreground/70 hover:text-foreground hover:bg-border/70 opacity-0 group-hover:ml-1 group-hover:w-4 group-hover:opacity-100 transition-all">x</button></span>`,
      );
    } else {
      const full = match[0] ?? "";
      const skillId = (match[1] ?? "").trim();
      const marker = full.trimEnd();
      const title = skillNameById[skillId];
      if (!title) {
        parts.push(escapeHtml(full));
      } else {
        parts.push(
          `<span data-badge-kind="skill" data-badge-id="${escapeHtmlAttribute(
            skillId,
          )}" data-badge-label="${escapeHtmlAttribute(title)}" data-badge-marker="${escapeHtmlAttribute(
            marker,
          )}" class="inline-flex items-center justify-start min-h-5 gap-1 rounded-[6px] border border-border/70 bg-surface px-1.5 py-0.5 text-xs font-medium text-foreground max-w-[140px] min-w-0 mr-1 overflow-hidden group" contenteditable="false"><i class="ri-apps-2-ai-line"></i><span class="flex-1 min-w-0 truncate whitespace-nowrap">${escapeHtml(
            title,
          )}</span><button type="button" data-badge-remove="true" data-badge-marker="${escapeHtmlAttribute(
            marker,
          )}" aria-label="Remove" class="ml-0 inline-flex h-4 w-0 shrink-0 items-center justify-center overflow-hidden rounded-[4px] text-[12px] leading-none text-muted-foreground/70 hover:text-foreground hover:bg-border/70 opacity-0 group-hover:ml-1 group-hover:w-4 group-hover:opacity-100 transition-all">x</button></span>`,
        );
      }
    }

    cursor = match.index + match[0].length;
    if (nextType === "event") {
      eMatch = eventRe.exec(text);
    } else if (nextType === "source") {
      fMatch = sourceRe.exec(text);
    } else {
      sMatch = skillRe.exec(text);
    }
  }

  if (cursor < text.length) {
    pushEscaped(text.slice(cursor));
  }

  return parts.join("").replace(/\n/g, "<br />");
}

/**
 * Convert a markdown string into a basic HTML representation.
 * This is intentionally minimal: it supports headings, unordered lists and paragraphs,
 * so the rich editor has a better starting point than raw markdown text.
 *
 * @param markdown Markdown input
 * @returns HTML string for tiptap content
 */
export function markdownToBasicHtml(
  markdown: string,
  skillNameById: Record<string, string>,
): string {
  if (!markdown.trim()) return "";

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const htmlParts: string[] = [];

  const flushParagraph = (buffer: string[]) => {
    const text = buffer.join("\n").trimEnd();
    if (!text) return;
    htmlParts.push(`<p>${renderInlineBadges(text, skillNameById)}</p>`);
  };

  let paragraphBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.trimEnd();

    if (line.trim().length === 0) {
      flushParagraph(paragraphBuffer);
      paragraphBuffer = [];
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushParagraph(paragraphBuffer);
      paragraphBuffer = [];
      htmlParts.push("<hr />");
      continue;
    }

    const headingMatch = line.match(/^#{1,6}\s+/);
    if (headingMatch) {
      flushParagraph(paragraphBuffer);
      paragraphBuffer = [];

      const level = Math.min(headingMatch[0].trim().length, 6);
      const title = line.replace(/^#{1,6}\s+/, "").trim();
      htmlParts.push(
        `<h${level}>${renderInlineBadges(title, skillNameById)}</h${level}>`,
      );
      continue;
    }

    if (/^[-*+]\s+/.test(line.trim())) {
      flushParagraph(paragraphBuffer);
      paragraphBuffer = [];

      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test((lines[i] ?? "").trim())) {
        const item = (lines[i] ?? "").replace(/^[-*+]\s+/, "").trim();
        if (item)
          items.push(`<li>${renderInlineBadges(item, skillNameById)}</li>`);
        i++;
      }
      i--;
      if (items.length > 0) {
        htmlParts.push(`<ul>${items.join("")}</ul>`);
      }
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph(paragraphBuffer);

  return htmlParts.length > 0 ? htmlParts.join("\n") : "";
}

/**
 * Normalize editor markdown output to a stable persisted format.
 */
export function normalizeEditorMarkdownOutput(markdown: string): string {
  return (
    markdown
      .replace(/\r\n/g, "\n")
      // Keep escaped unordered-list markers stable across editor round-trips.
      .replace(
        /(^|\n)([ \t]*)\\+([*+-])(?=\s)/g,
        (_, prefix, indent, marker) => {
          return `${prefix}${indent}\\${marker}`;
        },
      )
      // Turndown prefers padded unordered-list spacing; collapse to a single space
      // so markdown persists in a stable, compact form.
      .replace(/(^|\n)([ \t]*[*+-]) {2,}(?=\S)/g, "$1$2 ")
      .replace(/\n{2,}/g, "\n\n")
      .replace(/^\n+/, "")
      .replace(/\n+$/, "")
  );
}

export function createNovelInstructionTurndown(): TurndownService {
  const svc = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });

  svc.addRule("refBadge", {
    filter: (node) => {
      const el = node as HTMLElement;
      return el?.nodeName === "SPAN" && !!el.getAttribute("data-badge-marker");
    },
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const marker = el.getAttribute("data-badge-marker") ?? "";
      return `${marker} `;
    },
  });

  return svc;
}

/**
 * Convert HTML from tiptap back into markdown for storage + md rendering.
 */
export function htmlToMarkdown(
  html: string,
  turndown: TurndownService,
): string {
  const raw = turndown.turndown(html ?? "");
  return normalizeEditorMarkdownOutput(raw);
}

/**
 * Test helper for verifying markdown round-trips remain stable.
 */
export function roundTripMarkdown(
  markdown: string,
  skillNameById: Record<string, string> = {},
): string {
  const turndown = createNovelInstructionTurndown();
  return htmlToMarkdown(markdownToBasicHtml(markdown, skillNameById), turndown);
}
