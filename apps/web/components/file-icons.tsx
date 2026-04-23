import React from "react";
import { RemixIcon } from "@/components/remix-icon";

// File extensions supporting image preview (consistent with workspace file API)
export const IMAGE_FILE_EXTENSIONS = [
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
] as const;

/**
 * Detect if file path is an image file
 */
export function isImageFile(filePath: string): boolean {
  if (!filePath) return false;
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."));
  return IMAGE_FILE_EXTENSIONS.includes(
    ext as (typeof IMAGE_FILE_EXTENSIONS)[number],
  );
}

export type FileIconType =
  | "pdf"
  | "doc"
  | "docx"
  | "xls"
  | "xlsx"
  | "ppt"
  | "pptx"
  | "txt"
  | "md"
  | "code"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "default";

/** RemixIcon name to file extension mapping */
const EXT_TO_REMIX_ICON: Record<string, string> = {
  pdf: "file_text",
  doc: "file_type",
  docx: "file_type",
  odt: "file_type",
  rtf: "file_type",
  xls: "file_spreadsheet",
  xlsx: "file_spreadsheet",
  csv: "file_spreadsheet",
  ods: "file_spreadsheet",
  ppt: "presentation",
  pptx: "presentation",
  odp: "presentation",
  key: "presentation",
  pages: "file_type",
  numbers: "file_spreadsheet",
  keynote: "presentation",
  txt: "file_text",
  md: "code",
  json: "code",
  xml: "code",
  html: "code",
  css: "code",
  js: "code",
  ts: "code",
  py: "code",
  java: "code",
  c: "code",
  cpp: "code",
  go: "code",
  rs: "code",
  sh: "code",
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  svg: "image",
  webp: "image",
  bmp: "image",
  ico: "image",
  mp4: "video",
  webm: "video",
  mov: "video",
  avi: "video",
  mkv: "video",
  flv: "video",
  mp3: "music_2",
  wav: "music_2",
  ogg: "music_2",
  flac: "music_2",
  aac: "music_2",
  m4a: "music_2",
  zip: "file_archive",
  rar: "file_archive",
  "7z": "file_archive",
  tar: "file_archive",
  gz: "file_archive",
};

/**
 * Return file icon component based on file extension (using RemixIcon)
 */
export function getFileIcon(
  filename: string,
): React.ComponentType<{ className?: string }> {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const name = EXT_TO_REMIX_ICON[ext] ?? "file";
  return function FileIconComponent({ className }: { className?: string }) {
    return <RemixIcon name={name} className={className} />;
  };
}

/**
 * Return file icon name (RemixIcon name) based on file extension.
 * Use this when you need the icon name string for <RemixIcon name={...} />
 */
export function getFileIconName(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return EXT_TO_REMIX_ICON[ext] ?? "file";
}

/**
 * Get file color based on file type
 */
export function getFileColor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const colorMap: Record<string, string> = {
    // Documents - Red/Orange
    pdf: "text-red-600 dark:text-red-400",
    doc: "text-blue-600 dark:text-blue-400",
    docx: "text-blue-600 dark:text-blue-400",

    // Spreadsheets - Green
    xls: "text-green-600 dark:text-green-400",
    xlsx: "text-green-600 dark:text-green-400",
    csv: "text-green-600 dark:text-green-400",

    // Presentations - Orange
    ppt: "text-orange-600 dark:text-orange-400",
    pptx: "text-orange-600 dark:text-orange-400",

    // Apple Documents - Red/Pink (Pages), Green (Numbers), Orange (Keynote)
    pages: "text-red-600 dark:text-red-400",
    numbers: "text-green-600 dark:text-green-400",
    keynote: "text-orange-600 dark:text-orange-400",

    // Images - Purple
    jpg: "text-purple-600 dark:text-purple-400",
    jpeg: "text-purple-600 dark:text-purple-400",
    png: "text-purple-600 dark:text-purple-400",
    gif: "text-purple-600 dark:text-purple-400",
    svg: "text-purple-600 dark:text-purple-400",

    // Code - Yellow
    js: "text-yellow-600 dark:text-yellow-400",
    ts: "text-blue-500 dark:text-blue-300",
    py: "text-blue-400 dark:text-blue-200",
    json: "text-yellow-500 dark:text-yellow-300",
    md: "text-gray-600 dark:text-gray-400",

    // Archives - Gray
    zip: "text-gray-600 dark:text-gray-400",
    rar: "text-gray-600 dark:text-gray-400",
  };

  return colorMap[ext] || "text-gray-500 dark:text-gray-400";
}

/**
 * Get file type label
 */
export function getFileTypeLabel(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const labelMap: Record<string, string> = {
    pdf: "PDF",
    doc: "Word",
    docx: "Word",
    xls: "Excel",
    xlsx: "Excel",
    ppt: "PowerPoint",
    pptx: "PowerPoint",
    pages: "Pages",
    numbers: "Numbers",
    keynote: "Keynote",
    txt: "Text",
    md: "Markdown",
    jpg: "Image",
    jpeg: "Image",
    png: "Image",
    gif: "Image",
    mp4: "Video",
    mp3: "Audio",
    zip: "Archive",
  };

  return labelMap[ext] || ext.toUpperCase();
}
