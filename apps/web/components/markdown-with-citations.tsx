"use client";

import Link from "next/link";
import React, { memo, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
// Import remark-gfm directly to avoid Turbopack dynamic import issues
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./code-block";
import { CitationBadge } from "./citation-badge";
import type { Insight } from "@/lib/db/schema";
import { useTranslation } from "react-i18next";
import { openUrl } from "@/lib/tauri";

/**
 * Process citation markers in text, convert ^[ID]^ or [number] to clickable badges
 * Supports two formats:
 * 1. ^[Insight ID]^ - New format, use Insight ID directly
 * 2. [number] or [number, number] - Old format, use index (starting from 1)
 */
function processTextWithCitations(
  text: string,
  onCitationClick: (insightId: string) => void,
  insights?: Insight[],
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];

  // Preprocessing: remove excessive newlines in entire text, but keep single newlines between sentences
  // This prevents unnecessary newlines when replacing citations

  // Used to track citation numbers (starting from 1)
  const citationIndexMap = new Map<string, number>();
  let currentCitationIndex = 0;

  // Match three formats:
  // 1. ^[ID]^ - New format with brackets
  // 2. [number] or [number, number] - Old format, supports [4] or [4, 5] or [4,5,6]
  // 3. ^[ID]^ - UUID/ID without brackets (e.g., ^2faf4305-7774-4051-a2b9-4856fc9402e5^)
  const citationRegex =
    /\^\[([^\]]+)\]\^|\[(\d+(?:,\s*\d+)*)\]|\^([a-fA-F0-9-]+)\^/g;
  let lastIndex = 0;
  let match = citationRegex.exec(text);
  let keyCounter = 0;

  while (match) {
    // Add text before match
    if (match.index > lastIndex) {
      let textBefore = text.slice(lastIndex, match.index);
      // Remove all whitespace characters at end of text (spaces, newlines, etc.), since citation badge already has ml-1
      // This prevents extra whitespace before citation marker causing line breaks
      textBefore = textBefore.replace(/\s+$/, "");
      // Ensure text is a string, avoid [object Object] issue
      if (typeof textBefore === "string" && textBefore) {
        parts.push(
          <React.Fragment key={`text-${keyCounter++}`}>
            {textBefore}
          </React.Fragment>,
        );
      }
    }

    let insightId: string | undefined;
    let insight: Insight | undefined;
    let displayIndex: number | string | undefined;

    // Check if new format ^[ID]^ or old format [number]
    if (match[1]) {
      // New format: ^[ID]^
      const matchedId = match[1].toString();

      // Check if it's a pure number (possibly incorrect format like ^[1]^)
      const isNumeric = /^\d+$/.test(matchedId);

      if (isNumeric && insights) {
        // If it's a number, try using it as index (backward compatibility)
        const index = Number.parseInt(matchedId, 10) - 1;
        if (index >= 0 && index < insights.length) {
          insight = insights[index];
          insightId = insight.id;
          displayIndex = Number.parseInt(matchedId, 10);
        }
      } else {
        // Normal UUID format
        insightId = matchedId;
        insight = insights?.find((i) => i.id === insightId);

        // Assign a sequence number to this ID
        if (insightId && !citationIndexMap.has(insightId)) {
          currentCitationIndex++;
          citationIndexMap.set(insightId, currentCitationIndex);
        }
        displayIndex = citationIndexMap.get(insightId);
      }
    } else if (match[2] && insights) {
      // Old format: [number] or [number, number]
      // Extract all number indices (starting from 1)
      const indices = match[2]
        .split(/,?\s*/)
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n) && n > 0);

      // If there are multiple indices, use the first one
      if (indices.length > 0) {
        const index = indices[0] - 1; // Convert to 0-based index
        if (index >= 0 && index < insights.length) {
          insight = insights[index];
          insightId = insight.id;
          displayIndex = indices[0]; // Use original index as display number
        }
      }
    } else if (match[3]) {
      // New format without brackets: ^ID^ (e.g., ^2faf4305-7774-4051-a2b9-4856fc9402e5^)
      insightId = match[3];
      insight = insights?.find((i) => i.id === insightId);

      if (insightId && !citationIndexMap.has(insightId)) {
        currentCitationIndex++;
        citationIndexMap.set(insightId, currentCitationIndex);
      }
      displayIndex = citationIndexMap.get(insightId);
    }

    if (insightId && displayIndex) {
      parts.push(
        <CitationBadge
          key={`citation-${keyCounter++}`}
          index={displayIndex}
          platform={insight?.platform}
          tooltip={insight?.title ?? undefined}
          onClick={() => {
            if (insightId) {
              onCitationClick(insightId);
            }
          }}
        />,
      );
    }

    lastIndex = match.index + match[0].length;
    match = citationRegex.exec(text);
  }

  // Add remaining text
  if (lastIndex < text.length) {
    let remainingText = text.slice(lastIndex);
    // Remove all whitespace characters at beginning (spaces, newlines, etc.), prevent extra whitespace after citation badge causing line breaks
    remainingText = remainingText.replace(/^\s+/, "");
    // Ensure text is a string
    if (typeof remainingText === "string" && remainingText) {
      parts.push(
        <React.Fragment key={`text-${keyCounter++}`}>
          {remainingText}
        </React.Fragment>,
      );
    }
  }

  return parts.length > 0 ? parts : [text];
}

// Use shared utility function to detect image files
import { IMAGE_FILE_EXTENSIONS } from "@/components/file-icons";

/**
 * Detect file paths in text, return preview button if it's an image path
 * Supports Unix and Windows path formats
 */
function processTextWithFilePaths(
  text: string,
  onPreviewFile?: (file: { path: string; name: string; type: string }) => void,
  previewLabel?: string,
): React.ReactNode[] {
  if (!onPreviewFile) {
    return [text];
  }

  // Regular expression to match file paths
  // Supports:
  // - Unix absolute paths: /Users/xxx/xxx.png
  // - Windows absolute paths: C:\Users\xxx\xxx.png
  // - ~ prefixed paths: ~/xxx/xxx.png
  // - Relative paths: ./xxx.png, ../xxx.png
  // - Directory relative paths: subdir/xxx.png (directory name + filename)
  const previewableExtensions = [
    ...IMAGE_FILE_EXTENSIONS.map((ext) => ext.slice(1)), // Images: jpg, jpeg, gif, svg, webp, bmp, ico, avif, heic
    // Code files
    "py",
    "js",
    "ts",
    "tsx",
    "jsx",
    "rb",
    "go",
    "rs",
    "java",
    "cpp",
    "c",
    "cs",
    "php",
    "css",
    "scss",
    "json",
    "xml",
    "yaml",
    "yml",
    "sh",
    "bash",
    // Document files
    "txt",
    "md",
    "markdown",
    "html",
    "htm",
    "pdf",
    "doc",
    "docx",
    "odt",
    "rtf",
    // Office files
    "xlsx",
    "xls",
    "csv",
    "ods",
    "pptx",
    "ppt",
    "key",
    "odp",
    // Media files
    "mp4",
    "webm",
    "mov",
    "mp3",
    "wav",
    "ogg",
    // Mind map files
    "mmark",
  ];
  // Sort extensions by length descending, ensure matching longer extensions first (e.g., .tsx before .ts)
  const sortedExtensions = [...previewableExtensions].sort(
    (a, b) => b.length - a.length,
  );
  // Support multiple path formats (sorted by priority):
  // 1. ~ prefixed paths: ~/xxx/xxx.png
  // 2. ./ relative paths: ./xxx.png
  // 3. ../ relative paths: ../xxx.png
  // 4. / absolute paths: /Users/xxx/xxx.png
  // 5. C:\ Windows paths: C:\Users\xxx\xxx.png
  // 6. Directory relative paths: subdir/xxx.png (need directory name and filename)
  const pathRegex = new RegExp(
    `(?:~[/\\\\]|\\.[/\\\\]|\\.\\.[/\\\\]|[/\\\\]|[A-Za-z]:\\\\|(?:[^\\s\\\\/:*?"<>|]+[/\\\\]))(?:[^\\s\\\\/:*?"<>|]+[/\\\\])*[^\\s\\\\/:*?"<>|]+\\.(?:${sortedExtensions.join("|")})`,
    "gi",
  );

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let keyCounter = 0;
  let match: RegExpExecArray | null = pathRegex.exec(text);

  while (match !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      if (textBefore) {
        parts.push(
          <React.Fragment key={`text-${keyCounter++}`}>
            {textBefore}
          </React.Fragment>,
        );
      }
    }

    const filePath = match[0];
    const matchStart = match.index;

    // Detect if match is in a URL context (preceded by ://)
    const textBeforeMatch = text.slice(
      Math.max(0, matchStart - 10),
      matchStart,
    );
    const isInUrlContext = /:\/\//.test(textBeforeMatch);

    // If match is in a URL (e.g., https://...), skip preview badge
    if (isInUrlContext) {
      parts.push(
        <React.Fragment key={`text-${keyCounter++}`}>
          {filePath}
        </React.Fragment>,
      );
      lastIndex = matchStart + filePath.length;
      match = pathRegex.exec(text);
      continue;
    }

    // Check if it's a previewable file type (image, code, Markdown, PDF, etc.)
    const fileName = filePath.split(/[/\\]/).pop() || "";
    const fileExt = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
    const isPreviewable = previewableExtensions.includes(fileExt);

    if (isPreviewable) {
      parts.push(
        <React.Fragment key={`path-${keyCounter++}`}>
          <span className="text-muted-foreground">{filePath}</span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPreviewFile({
                path: filePath,
                name: fileName,
                type: fileExt,
              });
            }}
            className="shrink-0 ml-1 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title={previewLabel}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-400"
            >
              <title>{previewLabel}</title>
              <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z" />
            </svg>
          </button>
        </React.Fragment>,
      );
    } else {
      // Non-image files, only display text
      parts.push(
        <React.Fragment key={`path-${keyCounter++}`}>
          {filePath}
        </React.Fragment>,
      );
    }

    lastIndex = match.index + filePath.length;

    // Get next match
    match = pathRegex.exec(text);
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    if (remainingText) {
      parts.push(
        <React.Fragment key={`text-${keyCounter++}`}>
          {remainingText}
        </React.Fragment>,
      );
    }
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Recursively process file path previews in children
 * Used to process file paths inside strong, em and other tags
 */
function processChildrenWithFilePaths(
  children: React.ReactNode,
  onPreviewFile?: (file: { path: string; name: string; type: string }) => void,
  previewLabel?: string,
): React.ReactNode {
  if (!onPreviewFile) {
    return children;
  }

  // If it's a string, process directly
  if (typeof children === "string") {
    return processTextWithFilePaths(children, onPreviewFile, previewLabel);
  }

  // If it's an array, recursively process each element
  if (Array.isArray(children)) {
    return children.map((child, index) => {
      // Safely generate key, avoid circular reference issues
      const childKey =
        typeof child === "string"
          ? `frag-${index}-${child.slice(0, 20)}`
          : `frag-${index}-${(child as any)?.key || Math.random().toString(36).slice(2, 11)}`;
      return (
        <React.Fragment key={childKey}>
          {processChildrenWithFilePaths(child, onPreviewFile, previewLabel)}
        </React.Fragment>
      );
    });
  }

  // If it's a React element, recursively process its children
  if (React.isValidElement(children)) {
    const childProps = children.props as { children?: React.ReactNode };
    if (childProps?.children) {
      return React.cloneElement(
        children,
        {},
        processChildrenWithFilePaths(
          childProps.children,
          onPreviewFile,
          previewLabel,
        ),
      );
    }
    return children;
  }

  return children;
}

interface MarkdownWithCitationsProps {
  children: string;
  onCitationClick?: (insightId: string) => void;
  insights?: Insight[];
  onPreviewFile?: (file: { path: string; name: string; type: string }) => void;
}

const baseComponents: Partial<Components> = {
  code: (props) => {
    const { node, className, children, ...rest } = props;
    // Check if this is inline code (no className) vs code block (has className)
    const isInline = !className || className === "";
    return (
      <CodeBlock
        node={node}
        inline={isInline}
        className={className ?? ""}
        {...rest}
      >
        {children}
      </CodeBlock>
    );
  },
  pre: ({ children }) => <>{children}</>,
  p: ({ node, children, ...props }) => {
    // Check if children contain block-level elements (pre, div, table, code, etc.)
    // If they do, don't wrap with p tag, return children directly
    const BLOCK_LEVEL_TYPES = new Set([
      "pre",
      "div",
      "table",
      "blockquote",
      "ul",
      "ol",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "code",
    ]);
    const hasBlockLevelContent = Array.isArray(children)
      ? children.some((child) => {
          if (!React.isValidElement(child)) return false;
          // Handle native HTML elements (type is a string like "pre", "div")
          if (typeof child.type === "string") {
            return BLOCK_LEVEL_TYPES.has(child.type);
          }
          // Handle custom React components (type is a function/class)
          // Check displayName or function name to identify CodeBlock
          const typeName =
            (child.type as React.ComponentType)?.displayName ||
            (child.type as Function)?.name ||
            "";
          return (
            typeName === "CodeBlockImpl" ||
            BLOCK_LEVEL_TYPES.has(
              typeName as typeof BLOCK_LEVEL_TYPES extends Set<infer T>
                ? T
                : never,
            )
          );
        })
      : false;

    if (hasBlockLevelContent) {
      return <>{children}</>;
    }

    return (
      <p
        className="!mt-0 !mb-0 leading-relaxed text-[14px] text-zinc-950 dark:text-zinc-50 min-w-0"
        {...props}
      >
        {children}
      </p>
    );
  },
  ol: ({ node, children, ...props }) => {
    return (
      <ol
        className="list-decimal list-outside ml-6 mb-4 space-y-1 min-w-0"
        {...props}
      >
        {children}
      </ol>
    );
  },
  li: ({ node, children, ...props }) => {
    return (
      <li className="my-1 leading-relaxed break-words min-w-0" {...props}>
        {children}
      </li>
    );
  },
  ul: ({ node, children, ...props }) => {
    return (
      <ul
        className="list-disc list-outside ml-6 mb-4 space-y-1 min-w-0"
        {...props}
      >
        {children}
      </ul>
    );
  },
  a: ({ node, children, ...props }) => {
    return (
      // @ts-expect-error
      <Link
        className="text-primary hover:underline"
        target="_blank"
        rel="noreferrer"
        {...props}
      >
        {children}
      </Link>
    );
  },
  table: ({ node, children, ...props }) => {
    return (
      <div className="my-4 overflow-x-visible min-w-0">
        <table
          className="min-w-full border-collapse border border-zinc-200 dark:border-zinc-700"
          {...props}
        >
          {children}
        </table>
      </div>
    );
  },
  thead: ({ node, children, ...props }) => {
    return (
      <thead
        className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700"
        {...props}
      >
        {children}
      </thead>
    );
  },
  tbody: ({ node, children, ...props }) => {
    return <tbody {...props}>{children}</tbody>;
  },
  tr: ({ node, children, ...props }) => {
    return (
      <tr
        className="border-b border-zinc-200 dark:border-zinc-700 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
        {...props}
      >
        {children}
      </tr>
    );
  },
  th: ({ node, children, ...props }) => {
    return (
      <th
        className="px-4 py-2 text-left font-semibold text-zinc-900 dark:text-zinc-50"
        {...props}
      >
        {children}
      </th>
    );
  },
  td: ({ node, children, ...props }) => {
    return (
      <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300" {...props}>
        {children}
      </td>
    );
  },
};

/**
 * Remove "Citation Sources" section
 */
function removeCitationSourcesSection(text: string): string {
  // Match "Citation Sources" heading and its following content (until next h2 or end of document)
  const patterns = [
    // English
    /##\s*Citation Sources[\s\S]*?(?=##|$)/gi,
    // Chinese
    /##\s*Citation Sources[\s\S]*?(?=##|$)/gi,
    /##\s*Citation Sources[\s\S]*?(?=##|$)/gi,
  ];

  let result = text;
  for (const pattern of patterns) {
    result = result.replace(pattern, "");
  }

  return result.trim();
}

/**
 * Markdown component with citation marker support
 */
function NonMemoizedMarkdownWithCitations({
  children,
  onCitationClick,
  insights,
  onPreviewFile,
}: MarkdownWithCitationsProps) {
  const { t } = useTranslation();
  const remarkPlugins = [remarkGfm];

  // Remove "Citation Sources" section
  const processedText = useMemo(() => {
    return removeCitationSourcesSection(children);
  }, [children]);

  // Create custom components to handle citation markers
  const customComponents = useMemo(() => {
    const components = { ...baseComponents };

    // Generic content processing function, handles citation markers
    const processContent = (content: any): React.ReactNode => {
      // Extract text content (only strings/numbers, skip other React elements directly)
      let textContent = "";
      if (typeof content === "string") {
        textContent = content;
      } else if (typeof content === "number" || typeof content === "boolean") {
        textContent = String(content);
      } else if (Array.isArray(content)) {
        textContent = content
          .map((child) => {
            if (typeof child === "string") return child;
            if (typeof child === "number") return String(child);
            // React elements (badge and other processed nodes) don't extract text, avoid double processing
            if (React.isValidElement(child)) return "";
            return "";
          })
          .join("");
      } else if (React.isValidElement(content)) {
        // Single React element returned directly, skip text extraction
        return content;
      } else {
        textContent = String(content || "");
      }

      // Check if it contains citation markers
      const hasCitation =
        /\^\[([^\]]+)\]\^|\[(\d+(?:,\s*\d+)*)\]|\^[a-fA-F0-9-]+\^/.test(
          textContent,
        );
      if (!hasCitation) {
        return content;
      }

      // Process citation markers (use no-op if onCitationClick not provided)
      const clickHandler = onCitationClick ?? (() => {});
      return processTextWithCitations(textContent, clickHandler, insights);
    };

    // Helper function to recursively extract text content
    const extractTextContent = (node: any): string => {
      if (node === null || node === undefined) {
        return "";
      }
      if (typeof node === "string") {
        return node;
      }
      if (typeof node === "number" || typeof node === "boolean") {
        return String(node);
      }
      if (Array.isArray(node)) {
        return node.map(extractTextContent).join("");
      }
      // If it's a React element (contains badge and other processed nodes), skip without extracting text
      // This prevents parent components like blockquote/strong/em from processing already-processed citation badges again
      if (React.isValidElement(node)) {
        return "";
      }
      // For other objects, try JSON.stringify, but avoid circular references
      try {
        return JSON.stringify(node);
      } catch {
        return String(node);
      }
    };

    // Process citation markers in p tags
    components.p = ({ node, children, ...props }: any) => {
      // Check if children contains block-level elements (pre, div, table, code, etc.)
      // If it does, don't wrap with p tag, return children directly
      const BLOCK_LEVEL_TYPES = new Set([
        "pre",
        "div",
        "table",
        "blockquote",
        "ul",
        "ol",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "code",
      ]);
      const hasBlockLevelContent = Array.isArray(children)
        ? children.some((child) => {
            if (!React.isValidElement(child)) return false;
            if (typeof child.type === "string") {
              return BLOCK_LEVEL_TYPES.has(child.type);
            }
            const typeName =
              (child.type as React.ComponentType)?.displayName ||
              (child.type as Function)?.name ||
              "";
            return (
              typeName === "CodeBlock" ||
              BLOCK_LEVEL_TYPES.has(
                typeName as typeof BLOCK_LEVEL_TYPES extends Set<infer T>
                  ? T
                  : never,
              )
            );
          })
        : false;

      const processedChildren = processContent(children);

      if (hasBlockLevelContent) {
        return <>{processedChildren}</>;
      }

      return (
        <p
          className="!mt-0 !mb-0 leading-relaxed text-[14px] text-zinc-950 dark:text-zinc-50 min-w-0"
          {...props}
        >
          {processedChildren}
        </p>
      );
    };

    // Handle special case for li tag (Citation Sources list item) and citation markers
    components.li = ({ node, children: liChildren, ...props }: any) => {
      // Extract text content (use extractTextContent to avoid object conversion issues)
      const textContent = extractTextContent(liChildren);

      // Check if it's a list item in the "Citation Sources" section (citation marker at end)
      const citationAtEndMatch = textContent.match(
        /\^\[([^\]]+)\]\^\s*$|\[(\d+(?:,\s*\d+)*)\]\s*$/,
      );

      if (citationAtEndMatch && onCitationClick) {
        let insightId: string | undefined;
        let insight: Insight | undefined;

        // Extract insight ID
        if (citationAtEndMatch[1]) {
          const matchedId = citationAtEndMatch[1].toString();
          const isNumeric = /^\d+$/.test(matchedId);

          if (isNumeric && insights) {
            const index = Number.parseInt(matchedId, 10) - 1;
            if (index >= 0 && index < insights.length) {
              insight = insights[index];
              insightId = insight.id;
            }
          } else {
            insightId = matchedId;
            insight = insights?.find((i: Insight) => i.id === insightId);
          }
        } else if (citationAtEndMatch[2] && insights) {
          const indices = citationAtEndMatch[2]
            .split(/,?\s*/)
            .map((s) => Number.parseInt(s.trim(), 10))
            .filter((n) => !Number.isNaN(n) && n > 0);

          if (indices.length > 0) {
            const index = indices[0] - 1;
            if (index >= 0 && index < insights.length) {
              insight = insights[index];
              insightId = insight.id;
            }
          }
        }

        // Remove citation marker at end, keep text part
        const textWithoutCitation = textContent
          .replace(/\s*\^\[([^\]]+)\]\^\s*$|\s*\[(\d+(?:,\s*\d+)*)\]\s*$/, "")
          .trim();

        if (insightId && insight) {
          // Found insight, convert entire text to clickable hyperlink
          return (
            <li className="my-1 leading-relaxed min-w-0" {...props}>
              <button
                type="button"
                onClick={() => onCitationClick(insightId)}
                className="text-primary hover:underline cursor-pointer bg-transparent border-0 p-0 text-left font-inherit"
              >
                {textWithoutCitation}
              </button>
            </li>
          );
        }

        // Insight not found, return plain text with citation marker removed
        return (
          <li className="my-1 leading-relaxed min-w-0" {...props}>
            {textWithoutCitation}
          </li>
        );
      }

      // Normal li tag, use generic processing function
      const processedChildren = processContent(liChildren);
      return (
        <li className="my-1 leading-relaxed break-words min-w-0" {...props}>
          {processedChildren}
        </li>
      );
    };

    // Handle citation markers in td tag
    components.td = ({ node, children, ...props }: any) => {
      // Use depth-first approach to recursively process all text nodes
      const processChildrenDeep = (content: any): React.ReactNode => {
        // If it's a string, process citation markers directly
        if (typeof content === "string") {
          const hasCitation =
            /\^\[([^\]]+)\]\^|\[(\d+(?:,\s*\d+)*)\]|\^[a-fA-F0-9-]+\^/.test(
              content,
            );
          if (hasCitation) {
            const clickHandler = onCitationClick ?? (() => {});
            return processTextWithCitations(content, clickHandler, insights);
          }
          return content;
        }

        // If it's an array, recursively process each element
        if (Array.isArray(content)) {
          return content.map((child, index) => {
            // Generate a more unique key by combining index with child content
            const childKey =
              typeof child === "string"
                ? `td-frag-${index}-${child.slice(0, 20)}`
                : `td-frag-${index}-${child?.key || Math.random().toString(36).slice(2, 11)}`;
            return (
              <React.Fragment key={childKey}>
                {processChildrenDeep(child)}
              </React.Fragment>
            );
          });
        }

        // If it's a React element, recursively process its children
        if (React.isValidElement(content)) {
          const childProps = content.props as { children?: any };
          if (childProps?.children) {
            // Recursively process children and create new element
            return React.cloneElement(
              content,
              {},
              processChildrenDeep(childProps.children),
            );
          }
          return content;
        }

        return content;
      };

      const processedChildren = processChildrenDeep(children);
      return (
        <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300" {...props}>
          {processedChildren}
        </td>
      );
    };

    // Handle citation markers in th tag
    components.th = ({ node, children, ...props }: any) => {
      // Use depth-first approach to recursively process all text nodes
      const processChildrenDeep = (content: any): React.ReactNode => {
        // If it's a string, process citation markers directly
        if (typeof content === "string") {
          const hasCitation =
            /\^\[([^\]]+)\]\^|\[(\d+(?:,\s*\d+)*)\]|\^[a-fA-F0-9-]+\^/.test(
              content,
            );
          if (hasCitation) {
            const clickHandler = onCitationClick ?? (() => {});
            return processTextWithCitations(content, clickHandler, insights);
          }
          return content;
        }

        // If it's an array, recursively process each element
        if (Array.isArray(content)) {
          return content.map((child, index) => {
            // Generate a more unique key by combining index with child content
            const childKey =
              typeof child === "string"
                ? `th-frag-${index}-${child.slice(0, 20)}`
                : `th-frag-${index}-${child?.key || Math.random().toString(36).slice(2, 11)}`;
            return (
              <React.Fragment key={childKey}>
                {processChildrenDeep(child)}
              </React.Fragment>
            );
          });
        }

        // If it's a React element, recursively process its children
        if (React.isValidElement(content)) {
          const childProps = content.props as { children?: any };
          if (childProps?.children) {
            // Recursively process children and create new element
            return React.cloneElement(
              content,
              {},
              processChildrenDeep(childProps.children),
            );
          }
          return content;
        }

        return content;
      };

      const processedChildren = processChildrenDeep(children);
      return (
        <th
          className="px-4 py-2 text-left font-semibold text-zinc-900 dark:text-zinc-50"
          {...props}
        >
          {processedChildren}
        </th>
      );
    };

    // Handle citation markers and file path previews in a tags
    components.a = ({ node, children, ...props }: any) => {
      const href = props?.href || "";
      const previewLabel = t("common.preview", "Preview");

      // Check if href is a local file path
      let showPreviewButton = false;
      let previewFileData: { path: string; name: string; type: string } | null =
        null;

      if (onPreviewFile && href) {
        const IMAGE_FILE_EXTENSIONS = [
          ".png",
          ".jpg",
          ".jpeg",
          ".gif",
          ".svg",
          ".webp",
          ".bmp",
          ".ico",
          ".avif",
          ".heic",
        ];
        const previewableExtensions = [
          ...IMAGE_FILE_EXTENSIONS.map((ext) => ext.slice(1)),
          // Code files
          "py",
          "js",
          "ts",
          "tsx",
          "jsx",
          "rb",
          "go",
          "rs",
          "java",
          "cpp",
          "c",
          "cs",
          "php",
          "css",
          "scss",
          "json",
          "xml",
          "yaml",
          "yml",
          "sh",
          "bash",
          // Document files
          "txt",
          "md",
          "markdown",
          "html",
          "htm",
          "pdf",
          "doc",
          "docx",
          "odt",
          "rtf",
          // Office files
          "xlsx",
          "xls",
          "csv",
          "ods",
          "pptx",
          "ppt",
          "key",
          "odp",
          // Media files
          "mp4",
          "webm",
          "mov",
          "mp3",
          "wav",
          "ogg",
          // Mind map files
          "mmark",
        ];
        const sortedExtensions = [...previewableExtensions].sort(
          (a, b) => b.length - a.length,
        );

        const pathRegex = new RegExp(
          `(?:~[/\\\\]|\\.[/\\\\]|\\.\\.[/\\\\]|[/\\\\]|[A-Za-z]:\\\\|(?:[^\\s\\\\/:*?"<>|]+[/\\\\]))(?:[^\\s\\\\/:*?"<>|]+[/\\\\])*[^\\s\\\\/:*?"<>|]+\\.(?:${sortedExtensions.join("|")})`,
          "gi",
        );

        // Exclude URL links (http://, https://, etc.), only show preview button for local file paths
        const isUrl =
          /^https?:\/\//i.test(href) || /^[a-z][a-z0-9+.-]*:/i.test(href);
        if (!isUrl) {
          const pathMatch = pathRegex.exec(href);
          if (pathMatch) {
            const filePath = pathMatch[0];
            const fileName = filePath.split(/[/\\]/).pop() || "";
            const fileExt = fileName
              .slice(fileName.lastIndexOf(".") + 1)
              .toLowerCase();

            if (previewableExtensions.includes(fileExt)) {
              showPreviewButton = true;
              previewFileData = {
                path: filePath,
                name: fileName,
                type: fileExt,
              };
            }
          }
        }
      }

      // Use depth-first approach to recursively process all text nodes
      const processChildrenDeep = (content: any): React.ReactNode => {
        // If it's a string, process citation markers directly
        if (typeof content === "string") {
          const hasCitation =
            /\^\[([^\]]+)\]\^|\[(\d+(?:,\s*\d+)*)\]|\^[a-fA-F0-9-]+\^/.test(
              content,
            );
          if (hasCitation) {
            const clickHandler = onCitationClick ?? (() => {});
            return processTextWithCitations(content, clickHandler, insights);
          }
          return content;
        }

        // If it's an array, recursively process each element
        if (Array.isArray(content)) {
          return content.map((child, index) => {
            // Generate a more unique key by combining index with child content
            const childKey =
              typeof child === "string"
                ? `a-frag-${index}-${child.slice(0, 20)}`
                : `a-frag-${index}-${child?.key || Math.random().toString(36).slice(2, 11)}`;
            return (
              <React.Fragment key={childKey}>
                {processChildrenDeep(child)}
              </React.Fragment>
            );
          });
        }

        // If it's a React element, recursively process its children
        if (React.isValidElement(content)) {
          const childProps = content.props as { children?: any };
          if (childProps?.children) {
            // Recursively process children and create new element
            return React.cloneElement(
              content,
              {},
              processChildrenDeep(childProps.children),
            );
          }
          return content;
        }

        return content;
      };

      const processedChildren = processChildrenDeep(children);

      // If it's a file link, add preview button
      if (showPreviewButton && previewFileData) {
        return (
          <>
            <span
              role="link"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openUrl(href);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openUrl(href);
                }
              }}
              tabIndex={0}
              className="text-primary hover:underline cursor-pointer"
            >
              {processedChildren}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (previewFileData) {
                  onPreviewFile?.(previewFileData);
                }
              }}
              className="shrink-0 ml-1 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title={previewLabel}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-400"
              >
                <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z" />
              </svg>
            </button>
          </>
        );
      }

      return (
        <span
          role="link"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openUrl(href);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openUrl(href);
            }
          }}
          tabIndex={0}
          className="text-primary hover:underline cursor-pointer"
        >
          {processedChildren}
        </span>
      );
    };

    // Handle citation markers in all heading tags
    const headingSizes = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;
    const headingClasses = {
      h1: "text-2xl font-bold mb-4 mt-6",
      h2: "text-xl font-bold mb-3 mt-5",
      h3: "text-lg font-bold mb-3 mt-4",
      h4: "text-base font-bold mb-2 mt-4",
      h5: "text-sm font-bold mb-2 mt-4",
      h6: "text-sm font-bold mb-2 mt-4",
    };

    headingSizes.forEach((size) => {
      components[size] = ({ node, children, ...props }: any) => {
        const processedChildren = processContent(children);
        const Tag = size;
        return (
          <Tag className={headingClasses[size]} {...props}>
            {processedChildren}
          </Tag>
        );
      };
    });

    // Handle citation markers in strong tags (bold text)
    components.strong = ({ node, children, ...props }: any) => {
      const processedChildren = processContent(children);
      const previewLabel = t("common.preview", "Preview");

      // Handle file path preview
      const processedWithFilePaths = processChildrenWithFilePaths(
        processedChildren,
        onPreviewFile,
        previewLabel,
      );

      return (
        <strong className="font-bold" {...props}>
          {processedWithFilePaths}
        </strong>
      );
    };

    // Handle citation markers in em tags (italic text)
    components.em = ({ node, children, ...props }: any) => {
      const processedChildren = processContent(children);
      const previewLabel = t("common.preview", "Preview");

      // Handle file path preview
      const processedWithFilePaths = processChildrenWithFilePaths(
        processedChildren,
        onPreviewFile,
        previewLabel,
      );

      return (
        <em className="italic" {...props}>
          {processedWithFilePaths}
        </em>
      );
    };

    // Handle pre tags (code block container) - use CodeBlock for copy functionality
    // Note: children here is the result of components.code processing, which is <code> element
    components.pre = ({ children }: any) => {
      return (
        <CodeBlock node={{}} inline={false}>
          {children}
        </CodeBlock>
      );
    };

    // Handle file path previews in code tags (inline code, e.g., `path/to/file.html`)
    components.code = ({ node, className, children, ...props }: any) => {
      // Check if it's inline code vs code block
      // Code block: has className (language-xxx), inline code: no className or className is empty
      const isInline =
        !className || className === "" || !className.startsWith("language-");

      // For code blocks, return the code element directly (will be wrapped by components.pre)
      if (!isInline) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      }

      // Following is inline code processing logic
      if (onPreviewFile && children) {
        // Extract code content
        const codeContent = Array.isArray(children)
          ? children.join("")
          : String(children);

        // Check if it's a file path
        const IMAGE_FILE_EXTENSIONS = [
          ".png",
          ".jpg",
          ".jpeg",
          ".gif",
          ".svg",
          ".webp",
          ".bmp",
          ".ico",
          ".avif",
          ".heic",
        ];
        const previewableExtensions = [
          ...IMAGE_FILE_EXTENSIONS.map((ext) => ext.slice(1)),
          // Code files
          "py",
          "js",
          "ts",
          "tsx",
          "jsx",
          "rb",
          "go",
          "rs",
          "java",
          "cpp",
          "c",
          "cs",
          "php",
          "css",
          "scss",
          "json",
          "xml",
          "yaml",
          "yml",
          "sh",
          "bash",
          // Document files
          "txt",
          "md",
          "markdown",
          "html",
          "htm",
          "pdf",
          "doc",
          "docx",
          "odt",
          "rtf",
          // Office files
          "xlsx",
          "xls",
          "csv",
          "ods",
          "pptx",
          "ppt",
          "key",
          "odp",
          // Media files
          "mp4",
          "webm",
          "mov",
          "mp3",
          "wav",
          "ogg",
          // Mind map files
          "mmark",
        ];
        const sortedExtensions = [...previewableExtensions].sort(
          (a, b) => b.length - a.length,
        );

        const pathRegex = new RegExp(
          `(?:~[/\\\\]|\\.[/\\\\]|\\.\\.[/\\\\]|[/\\\\]|[A-Za-z]:\\\\|(?:[^\\s\\\\/:*?"<>|]+[/\\\\]))(?:[^\\s\\\\/:*?"<>|]+[/\\\\])*[^\\s\\\\/:*?"<>|]+\\.(?:${sortedExtensions.join("|")})`,
          "gi",
        );

        const pathMatch = pathRegex.exec(codeContent);
        if (pathMatch) {
          const filePath = pathMatch[0];
          const fileName = filePath.split(/[/\\]/).pop() || "";
          const fileExt = fileName
            .slice(fileName.lastIndexOf(".") + 1)
            .toLowerCase();

          if (previewableExtensions.includes(fileExt)) {
            const previewLabel = t("common.preview", "Preview");

            return (
              <>
                <code className={className} {...props}>
                  {children}
                </code>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreviewFile?.({
                      path: filePath,
                      name: fileName,
                      type: fileExt,
                    });
                  }}
                  className="shrink-0 ml-1 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                  title={previewLabel}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-gray-400"
                  >
                    <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z" />
                  </svg>
                </button>
              </>
            );
          }
        }
      }

      // Default handling: use CodeBlock to render inline code (with background style)
      return (
        <CodeBlock
          node={node}
          inline={true}
          className={className ?? ""}
          {...props}
        >
          {processContent(children)}
        </CodeBlock>
      );
    };

    // Handle citation markers in blockquote tags
    components.blockquote = ({ node, children, ...props }: any) => {
      const processedChildren = processContent(children);
      return (
        <blockquote
          className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 my-4 italic text-zinc-600 dark:text-zinc-400"
          {...props}
        >
          {processedChildren}
        </blockquote>
      );
    };

    // Handle citation markers and file paths in pure text nodes
    components.text = ({ node: textNode }: any) => {
      const text = String(textNode?.value || "");
      let processed: React.ReactNode[] = [text];

      // Process citation markers first
      const clickHandler = onCitationClick ?? (() => {});
      processed = processTextWithCitations(text, clickHandler, insights);

      // Then process file path previews
      const previewLabel = t("common.preview", "Preview");
      if (
        onPreviewFile &&
        processed.length === 1 &&
        typeof processed[0] === "string"
      ) {
        processed = processTextWithFilePaths(
          processed[0] as string,
          onPreviewFile,
          previewLabel,
        );
      } else if (onPreviewFile) {
        // If there are multiple nodes, merge first then process
        const combinedText = processed
          .map((p) => (typeof p === "string" ? p : ""))
          .join("");
        processed = processTextWithFilePaths(
          combinedText,
          onPreviewFile,
          previewLabel,
        );
      }

      return <>{processed}</>;
    };

    return components;
  }, [onCitationClick, insights, onPreviewFile, t]);

  return (
    <div className="w-full min-w-0">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={customComponents}
        className="markdown-wrapper"
      >
        {processedText}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownWithCitations = memo(
  NonMemoizedMarkdownWithCitations,
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.onCitationClick === nextProps.onCitationClick &&
    prevProps.insights === nextProps.insights &&
    prevProps.onPreviewFile === nextProps.onPreviewFile,
);
