"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import useSWR from "swr";
import { useTranslation } from "react-i18next";
import TurndownService from "turndown";
import { cn, fetcher } from "@/lib/utils";
import { toast } from "sonner";
import { buildRefMarker } from "@alloomi/shared/ref";
import { EditorContent, useEditor } from "@tiptap/react";
import { Node as TiptapNode } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import type { Insight } from "@/lib/db/schema";
import { Button, Input } from "@alloomi/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@alloomi/ui";
import { RemixIcon } from "@/components/remix-icon";
import { Spinner } from "@/components/spinner";

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

type SkillItem = {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  argumentHint?: string;
};

type SourceBadgeInput = {
  id: string;
  label: string;
  kind?: "file" | "folder";
};

/**
 * Inline renderer for event/skill tokens:
 * - event: [[ref:event:id|title]] (optionally followed by spaces)
 * - skill: /skill-xxx (followed by spaces)
 *
 * This is used to build the tiptap HTML representation from stored markdown.
 */
function renderInlineBadges(
  text: string,
  skillNameById: Record<string, string>,
): string {
  const eventRe = /\[\[ref:event:([^\]]*)\]\]\s*/g;
  const sourceRe = /\[\[ref:(file|folder):([^\]|]+)\|([^\]]+)\]\]\s*/g;
  // Skill token might lose trailing whitespace when persisted/trimmed.
  // Also sometimes tokens can be adjacent like `/id1/id2`, so we allow `/`
  // as a valid delimiter after the skill id.
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
        // Unknown `/...` segment: keep as plain text.
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
function markdownToBasicHtml(
  markdown: string,
  skillNameById: Record<string, string>,
): string {
  if (!markdown.trim()) return "";

  // Parse line by line, avoid missing #/## headings that appear in the middle of double-newline-separated blocks.
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

    // Empty line => end of paragraph
    if (line.trim().length === 0) {
      flushParagraph(paragraphBuffer);
      paragraphBuffer = [];
      continue;
    }

    // Horizontal rule: --- or ***
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushParagraph(paragraphBuffer);
      paragraphBuffer = [];
      htmlParts.push("<hr />");
      continue;
    }

    // Heading: #..###### <space>
    const headingMatch = line.match(/^#{1,6}\s+/);
    if (headingMatch) {
      flushParagraph(paragraphBuffer);
      paragraphBuffer = [];

      const level = Math.min(headingMatch[0].length, 6);
      const title = line.replace(/^#{1,6}\s+/, "").trim();
      htmlParts.push(
        `<h${level}>${renderInlineBadges(title, skillNameById)}</h${level}>`,
      );
      continue;
    }

    // Unordered list: -, *, +
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
      i--; // for-loop will increment
      if (items.length > 0) {
        htmlParts.push(`<ul>${items.join("")}</ul>`);
      }
      continue;
    }

    // Default: accumulate paragraph lines
    paragraphBuffer.push(line);
  }

  flushParagraph(paragraphBuffer);

  return htmlParts.length > 0 ? htmlParts.join("\n") : "";
}

/**
 * Convert HTML from tiptap back into markdown for storage + md rendering.
 *
 * @param html HTML output from editor
 * @returns markdown string
 */
function htmlToMarkdown(html: string, turndown: TurndownService): string {
  const raw = turndown.turndown(html ?? "");
  // Avoid trimming trailing spaces: skill/event token parsing relies on
  // whitespace after tokens (e.g. `/skill-xxx\\s`).
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
}

/**
 * Inline badge node used by tiptap for event/skill tokens.
 *
 * It renders as a styled `span` with data attributes, and turndown converts it back
 * to the original marker token stored in markdown.
 */
const RefBadgeNode = TiptapNode.create({
  name: "refBadge",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      kind: { default: "event" },
      id: { default: "" },
      label: { default: "" },
      marker: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-badge-kind][data-badge-marker]",
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          const kind = el.getAttribute("data-badge-kind") ?? "event";
          const id = el.getAttribute("data-badge-id") ?? "";
          const label =
            el.getAttribute("data-badge-label") ?? el.textContent ?? "";
          const marker = el.getAttribute("data-badge-marker") ?? "";
          return { kind, id, label, marker };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const kind = node.attrs.kind as string;
    const id = node.attrs.id as string;
    const label = node.attrs.label as string;
    const marker = node.attrs.marker as string;

    const classes =
      "inline-flex items-center justify-start min-h-5 gap-1 rounded-[6px] border border-border/70 bg-surface px-1.5 py-0.5 text-xs font-medium text-foreground max-w-[140px] min-w-0 mr-1 overflow-hidden group";

    return [
      "span",
      {
        "data-badge-kind": kind,
        "data-badge-id": id,
        "data-badge-label": label,
        "data-badge-marker": marker,
        class: classes,
        contenteditable: "false",
      },
      // Left icon
      [
        "i",
        {
          class:
            kind === "event"
              ? "ri-radar-line"
              : kind === "file"
                ? "ri-file-line"
                : kind === "folder"
                  ? "ri-folder-line"
                  : "ri-apps-2-ai-line",
        },
      ],
      // Text area truncation: no wrap, truncate and ellipsis when exceeding max width
      ["span", { class: "flex-1 min-w-0 truncate whitespace-nowrap" }, label],
      // Badge right-side hover shows remove button
      [
        "button",
        {
          type: "button",
          "data-badge-remove": "true",
          "data-badge-marker": marker,
          "aria-label": "Remove",
          class:
            "ml-0 inline-flex h-4 w-0 shrink-0 items-center justify-center overflow-hidden rounded-[4px] text-[12px] leading-none text-muted-foreground/70 hover:text-foreground hover:bg-border/70 opacity-0 group-hover:ml-1 group-hover:w-4 group-hover:opacity-100 transition-all",
        },
        "x",
      ],
    ];
  },
});

interface NovelInstructionEditorProps {
  /**
   * Markdown value to edit (stored as markdown for md rendering).
   */
  value: string;
  onChange: (next: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Whether to show "Add event/Add skill" buttons for inserting inline badges.
   */
  showSkillEventButtons?: boolean;
  /**
   * Callback for drag-and-drop file upload.
   */
  onFileDrop?: (files: File[]) => void | Promise<void>;
  /**
   * Callback for drag-and-drop folder.
   */
  onFolderDrop?: (
    folderPath: string,
    folderName: string,
  ) => void | Promise<void>;
}

export type NovelInstructionEditorRef = {
  /**
   * Opens the "Add Tracking Event" picker.
   * Prioritizes saving current cursor selection to ensure badge is inserted at the correct position.
   */
  openEventPicker: () => void;
  /**
   * Opens the "Select Skill" picker.
   * Prioritizes saving current cursor selection to ensure badge is inserted at the correct position.
   */
  openSkillPicker: () => void;
  /**
   * Inserts a file/folder badge at current cursor position.
   */
  insertSourceBadge: (source: SourceBadgeInput) => void;
};

/**
 * Novel-style instruction editor (Notion-like rich editor).
 * Uses the existing `RichTextEditor` (tiptap) but stores value as markdown.
 */
export const NovelInstructionEditor = forwardRef<
  NovelInstructionEditorRef,
  NovelInstructionEditorProps
>(function NovelInstructionEditor(
  {
    value,
    onChange,
    className,
    id,
    placeholder = "Write some instructions (Markdown supported)...",
    disabled = false,
    showSkillEventButtons = false,
    onFileDrop,
    onFolderDrop,
  }: NovelInstructionEditorProps,
  ref,
) {
  const { t } = useTranslation();

  /**
   * Bump this number when the badge HTML/classes change.
   * When Fast Refresh/hot reload happens without unmounting, existing editor DOM
   * would otherwise keep the old badge markup because we intentionally skip
   * `setContent` when value hasn't changed.
   */
  const BADGE_RENDER_VERSION = 10;
  // turndown instance is stable to avoid rule re-registration
  const turndown = useMemo(() => {
    const svc = new TurndownService({
      headingStyle: "atx",
      bulletListMarker: "-",
      codeBlockStyle: "fenced",
    });

    // Serialize ref badge nodes back to the original marker tokens.
    svc.addRule("refBadge", {
      filter: (node) => {
        const el = node as HTMLElement;
        return (
          el?.nodeName === "SPAN" && !!el.getAttribute("data-badge-marker")
        );
      },
      replacement: (_content, node) => {
        const el = node as HTMLElement;
        const marker = el.getAttribute("data-badge-marker") ?? "";
        // Always append a single space so downstream parsers that expect whitespace
        // (e.g. `/skill-xxx\s`) can reliably detect tokens.
        return `${marker} `;
      },
    });

    return svc;
  }, []);

  const lastEmittedMarkdownRef = useRef<string>(value);
  const lastBadgeRenderVersionRef = useRef<number>(BADGE_RENDER_VERSION);

  const [isSkillPickerOpen, setIsSkillPickerOpen] = useState(false);
  const [isEventPickerOpen, setIsEventPickerOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");

  const [eventQuery, setEventQuery] = useState("");
  const [debouncedEventQuery, setDebouncedEventQuery] = useState("");

  // Save cursor position before opening a modal so insertion happens at the correct location.
  const lastSelectionRef = useRef<{ from: number; to: number } | null>(null);

  /**
   * Fetch skills for badge labels and the skill picker.
   */
  const { data: skillsData } = useSWR<{
    success: boolean;
    skills: SkillItem[];
  }>(disabled ? null : "/api/workspace/skills", fetcher, {
    revalidateOnFocus: false,
  });

  const skillsList = skillsData?.skills ?? [];

  /**
   * Build id -> name map for rendering existing skill tokens as badge labels.
   */
  const skillNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of skillsList) map[s.id] = s.name;
    return map;
  }, [skillsList]);

  const skillLabelsKey = useMemo(() => {
    // Stable key for "skills -> badge labels" changes.
    return skillsList.map((s) => `${s.id}:${s.name}`).join("|");
  }, [skillsList]);

  const lastSkillLabelsKeyRef = useRef<string>("");

  const filteredSkills = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    if (!q) return skillsList;
    return skillsList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q),
    );
  }, [skillsList, skillQuery]);

  /**
   * Compute event search URL for the event picker dialog.
   */
  const eventSearchUrl = useMemo(() => {
    if (!isEventPickerOpen) return null;
    if (debouncedEventQuery.trim()) {
      return `/api/search?q=${encodeURIComponent(debouncedEventQuery)}&types=events&limit=50`;
    }
    return "/api/insights/events?limit=20&days=0";
  }, [debouncedEventQuery, isEventPickerOpen]);

  const { data: eventSearchData, isLoading: isEventLoading } = useSWR<{
    events?: Array<{ extra?: { insight?: Insight } }>;
    items?: Insight[];
  }>(eventSearchUrl, fetcher, { revalidateOnFocus: false });

  /**
   * Normalize event search response into an Insight list.
   */
  const eventList = useMemo((): Insight[] => {
    const data = eventSearchData;
    if (!data) return [];
    if (data.events) {
      return data.events
        .map((it) => it.extra?.insight)
        .filter((insight): insight is Insight => !!insight);
    }
    if (data.items) return data.items;
    return [];
  }, [eventSearchData]);

  // Debounce event query typing.
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedEventQuery(eventQuery),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [eventQuery]);

  /**
   * TipTap editor instance.
   * - Keep heading enabled so `# ` / `## ` input becomes real headings.
   * - Store editor content as HTML, but persist as markdown to parent.
   */
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      // Keep heading enabled: otherwise `#` / `##` will remain plain text.
      StarterKit.configure({
        // For instruction blocks, inline code is often enough.
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline hover:no-underline",
        },
      }),
      Placeholder.configure({
        placeholder,
        showOnlyCurrent: false,
        emptyEditorClass:
          "before:content-[attr(data-placeholder)] before:text-muted-foreground before:float-left before:pointer-events-none before:h-0",
      }),
      RefBadgeNode,
    ],
    content: markdownToBasicHtml(value, skillNameById),
    editorProps: {
      attributes: {
        class: cn(
          // Match the old textarea look (no border/radius/background chrome).
          "prose prose-sm max-w-none focus:outline-none",
          "h-full min-h-0 w-full bg-transparent",
          "px-4 pt-4 pb-4 text-[14px] leading-normal",
          // Tighten typography for instruction density.
          "prose-p:my-0.5 prose-p:leading-normal",
          "prose-ul:my-0 prose-ol:my-0",
          "prose-li:my-0.5",
          "prose-headings:leading-tight",
          "prose-p:my-1 prose-p:leading-loose",
          "prose-h1:text-[20px] prose-h1:my-1",
          "prose-h2:text-[18px] prose-h2:my-1",
          "prose-h3:text-[16px] prose-h3:my-1",
          "prose-h4:text-[15px] prose-h4:my-1",
          "prose-h5:text-[15px] prose-h5:my-1",
          "prose-h6:text-[15px] prose-h6:my-1",
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html, turndown);
      if (markdown === lastEmittedMarkdownRef.current) return;
      lastEmittedMarkdownRef.current = markdown;
      onChange(markdown);
    },
  });

  /**
   * Sync from external value changes (e.g. loading job detail),
   * but avoid cursor jump while the editor is focused.
   */
  useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) return;
    const shouldSkip =
      value === lastEmittedMarkdownRef.current &&
      lastSkillLabelsKeyRef.current === skillLabelsKey &&
      lastBadgeRenderVersionRef.current === BADGE_RENDER_VERSION;
    if (shouldSkip) return;

    lastSkillLabelsKeyRef.current = skillLabelsKey;
    lastBadgeRenderVersionRef.current = BADGE_RENDER_VERSION;
    editor.commands.setContent(markdownToBasicHtml(value, skillNameById));
    lastEmittedMarkdownRef.current = value;
  }, [editor, value, skillNameById, skillLabelsKey, BADGE_RENDER_VERSION]);
  const isEditorReady = !!editor;

  /**
   * Save current editor selection range before opening picker dialogs.
   */
  const saveSelection = useCallback(() => {
    if (!editor) return;
    const sel = editor.state.selection;
    lastSelectionRef.current = { from: sel.from, to: sel.to };
  }, [editor]);

  /**
   * Restore previously saved selection range (so insertion uses the original cursor position).
   */
  const restoreSelection = useCallback(() => {
    if (!editor) return;
    const range = lastSelectionRef.current;
    if (!range) return;
    editor.commands.setTextSelection({ from: range.from, to: range.to });
  }, [editor]);

  /**
   * When clicking `x` inside a badge, removes the corresponding token from markdown and immediately refreshes tiptap content.
   */
  const removeBadgeByMarker = useCallback(
    (badgeMarker: string) => {
      if (!editor) return;
      if (!badgeMarker) return;

      const escapeRegExp = (s: string): string =>
        s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const escaped = escapeRegExp(badgeMarker);
      // Delete badge token itself and its immediately following whitespace (if next token is adjacent to `/`, this won't accidentally swallow it).
      const re = new RegExp(`${escaped}\\s*`, "g");
      const nextMarkdown = value.replace(re, "");

      if (nextMarkdown === value) return;

      lastEmittedMarkdownRef.current = nextMarkdown;
      onChange(nextMarkdown);
      editor.commands.setContent(
        markdownToBasicHtml(nextMarkdown, skillNameById),
      );

      // Try to maintain user's sense of current position: restore first, then focus.
      restoreSelection();
      editor.commands.focus();
    },
    [editor, onChange, restoreSelection, skillNameById, value],
  );

  useEffect(() => {
    if (!editor) return;

    const dom = editor.view.dom;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const button = target?.closest(
        '[data-badge-remove="true"]',
      ) as HTMLElement | null;
      if (!button) return;

      const badgeMarker = button.getAttribute("data-badge-marker") ?? "";
      if (!badgeMarker) return;

      e.preventDefault();
      e.stopPropagation();

      saveSelection();
      removeBadgeByMarker(badgeMarker);
    };

    dom.addEventListener("click", onClick);
    return () => dom.removeEventListener("click", onClick);
  }, [editor, removeBadgeByMarker, saveSelection]);

  /**
   * Open "Add Tracking Event" picker (called by external button).
   */
  const openEventPicker = useCallback(() => {
    if (disabled) return;
    if (!editor) return;
    saveSelection();
    setIsSkillPickerOpen(false);
    setIsEventPickerOpen(true);
  }, [disabled, editor, saveSelection]);

  /**
   * Open "Select Skill" picker (called by external button).
   */
  const openSkillPicker = useCallback(() => {
    if (disabled) return;
    if (!editor) return;
    saveSelection();
    setIsEventPickerOpen(false);
    setIsSkillPickerOpen(true);
  }, [disabled, editor, saveSelection]);

  /**
   * Insert an event badge at the current cursor position.
   */
  const insertEventBadge = useCallback(
    (event: Insight) => {
      if (!editor) return;
      const title = event.title || event.id;
      const marker = buildRefMarker("event", `${event.id}|${title}`);

      restoreSelection();
      editor
        .chain()
        .focus()
        .insertContent({
          type: "refBadge",
          attrs: {
            kind: "event",
            id: event.id,
            label: title,
            marker,
          },
        })
        .run();

      setIsEventPickerOpen(false);
      setEventQuery("");
      setDebouncedEventQuery("");
    },
    [editor, restoreSelection],
  );

  /**
   * Insert a skill badge at the current cursor position.
   */
  const insertSkillBadge = useCallback(
    (skill: SkillItem) => {
      if (!editor) return;
      const marker = `/${skill.id}`;

      restoreSelection();
      editor
        .chain()
        .focus()
        .insertContent({
          type: "refBadge",
          attrs: {
            kind: "skill",
            id: skill.id,
            label: skill.name,
            marker,
          },
        })
        .run();

      setIsSkillPickerOpen(false);
      setSkillQuery("");
    },
    [editor, restoreSelection],
  );

  /**
   * Insert a file/folder badge at the current cursor position.
   */
  const insertSourceBadge = useCallback(
    (source: SourceBadgeInput) => {
      if (!editor) return;
      const sourceKind = source.kind ?? "file";
      const marker = `[[ref:${sourceKind}:${source.id}|${source.label}]]`;

      // Determine the insertion position
      let pos: number;
      if (lastSelectionRef.current) {
        pos = lastSelectionRef.current.from;
      } else {
        pos = editor.state.doc.content.size;
        if (pos === 0) pos = 1;
      }

      // First focus the editor
      editor.commands.focus();

      // Then set selection and insert
      editor
        .chain()
        .setTextSelection(pos)
        .insertContent({
          type: "refBadge",
          attrs: {
            kind: sourceKind,
            id: source.id,
            label: source.label,
            marker,
          },
        })
        .run();
    },
    [editor],
  );

  useImperativeHandle(
    ref,
    () => ({
      openEventPicker,
      openSkillPicker,
      insertSourceBadge,
    }),
    [insertSourceBadge, openEventPicker, openSkillPicker],
  );

  /**
   * Handle dialog open changes and keep related search query state consistent.
   */
  const handleEventOpenChange = useCallback((open: boolean) => {
    setIsEventPickerOpen(open);
    if (!open) {
      setEventQuery("");
      setDebouncedEventQuery("");
    }
  }, []);

  /**
   * Handle skill dialog open changes and keep related search state consistent.
   */
  const handleSkillOpenChange = useCallback((open: boolean) => {
    setIsSkillPickerOpen(open);
    if (!open) setSkillQuery("");
  }, []);

  /**
   * Handle drag over event to show visual feedback.
   */
  const handleEditorDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  /**
   * Handle drag enter event to ensure we capture the drag.
   */
  const handleEditorDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  /**
   * Handle drag leave event - only clear drag state if leaving the editor area.
   */
  const handleEditorDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (
      clientX < rect.left ||
      clientX >= rect.right ||
      clientY < rect.top ||
      clientY >= rect.bottom
    ) {
      setIsDragOver(false);
    }
  }, []);

  /**
   * Handle file drop event.
   */
  const handleEditorDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (disabled || !onFileDrop) return;

      const files: File[] = [];
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          // Handle folder drop - extract folder path and name
          if (onFolderDrop) {
            // entry.fullPath might be empty or just "/" for root, use name as fallback
            const folderPath = entry.fullPath || entry.name;
            const folderName = entry.name;
            await onFolderDrop(folderPath, folderName);
          } else {
            toast.error(
              t(
                "character.sources.useBindFolderButton",
                "Please use 'Bind Folder' button to bind folders",
              ),
            );
          }
          return;
        }
        const file = item.getAsFile();
        if (file) files.push(file);
      }
      if (files.length > 0) await onFileDrop(files);
    },
    [disabled, onFileDrop, onFolderDrop, t],
  );

  return (
    <div className={cn("h-full min-h-0 flex flex-col", className)}>
      {showSkillEventButtons && (
        <div className="flex items-center gap-2 mb-2 shrink-0 px-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-lg"
            onClick={() => {
              saveSelection();
              setIsEventPickerOpen(true);
            }}
            aria-label={t("chat.addEvent", "Add event")}
            disabled={disabled || !isEditorReady}
          >
            <span className="font-mono leading-none">@</span>
            <span>{t("chat.addEvent", "Add event")}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-lg"
            onClick={() => {
              saveSelection();
              setIsSkillPickerOpen(true);
            }}
            aria-label={t("chat.addSkill", "Select skill")}
            disabled={disabled || !isEditorReady}
          >
            <RemixIcon name="apps_2_ai" size="size-4" />
            <span>{t("chat.addSkill", "Select skill")}</span>
          </Button>
        </div>
      )}

      <div
        id={id}
        role="region"
        aria-label="Content drop zone"
        className={cn(
          "flex-1 min-h-0 overflow-y-auto rounded-none border-0 bg-transparent transition-colors",
          isDragOver && "border-2 border-dashed border-primary bg-primary/5",
        )}
        onDragEnter={handleEditorDragEnter}
        onDragOver={handleEditorDragOver}
        onDragLeave={handleEditorDragLeave}
        onDrop={handleEditorDrop}
      >
        {editor ? <EditorContent editor={editor} /> : null}
      </div>

      {/* Skills picker */}
      <Dialog open={isSkillPickerOpen} onOpenChange={handleSkillOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("chat.addSkill", "Select skill")}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Input
              value={skillQuery}
              onChange={(e) => setSkillQuery(e.target.value)}
              placeholder={t("chat.searchSkillPlaceholder", "Search skills...")}
              disabled={disabled}
            />

            <div className="max-h-[60vh] overflow-y-auto border rounded-lg">
              {skillsData === undefined ? (
                <div className="p-6 flex items-center justify-center text-muted-foreground">
                  <Spinner size={18} />
                  <span className="ml-2 text-sm">
                    {t("common.loading", "Loading")}
                  </span>
                </div>
              ) : filteredSkills.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">
                  {t("chat.noMatch", "No matching items")}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredSkills.map((skill) => (
                    <button
                      key={skill.id}
                      type="button"
                      className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                      onClick={() => insertSkillBadge(skill)}
                      disabled={disabled}
                    >
                      <div className="font-medium text-sm truncate">
                        {skill.name}
                      </div>
                      {skill.description && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {skill.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Events picker */}
      <Dialog open={isEventPickerOpen} onOpenChange={handleEventOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("chat.addEvent", "Add event")}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <Input
              value={eventQuery}
              onChange={(e) => setEventQuery(e.target.value)}
              placeholder={t(
                "chat.searchEventPlaceholder",
                "Search event name...",
              )}
              disabled={disabled}
            />

            <div className="flex-1 overflow-y-auto min-h-0 border rounded-lg">
              {isEventLoading ? (
                <div className="p-12 flex items-center justify-center text-muted-foreground">
                  <Spinner size={20} />
                  <span className="ml-2 text-sm">
                    {t("common.loading", "Loading")}
                  </span>
                </div>
              ) : eventList.length === 0 ? (
                <div className="p-8 text-sm text-muted-foreground text-center">
                  {t("chat.noEvents", "No events")}
                </div>
              ) : (
                <div className="divide-y">
                  {eventList.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                      onClick={() => insertEventBadge(event)}
                      disabled={disabled}
                    >
                      <div className="font-medium text-sm truncate">
                        {event.title ||
                          t("chat.untitledEvent", "Untitled event")}
                      </div>
                      {event.description && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">
                          {event.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});
