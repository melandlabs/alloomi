"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { RemixIcon } from "@/components/remix-icon";
import { FocusSourceIcon } from "@/components/focus/source-icon";
import type {
  FocusAction,
  FocusReasoningStep,
  FocusReasoningFile,
  FocusSourceLink,
} from "@/lib/types/daily-focus";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReasoningChainAccordionProps {
  /** Reasoning chain steps ordered chronologically (most recent first). */
  steps: FocusReasoningStep[];
  /** Optional extra class names. */
  className?: string;
  /** Callback when an attached file or link is clicked. */
  onActionClick?: (action: FocusAction) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatStepTime(isoTime: string, locale: string): string {
  try {
    const d = new Date(isoTime);
    return d.toLocaleString(locale.includes("zh") ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoTime;
  }
}

function getConfidenceColor(confidence?: number): string {
  if (confidence === undefined) return "text-muted-foreground";
  if (confidence >= 80) return "text-green-600";
  if (confidence >= 50) return "text-yellow-600";
  return "text-red-500";
}

function getConfidenceBg(confidence?: number): string {
  if (confidence === undefined) return "bg-muted-foreground/20";
  if (confidence >= 80) return "bg-green-100 text-green-700";
  if (confidence >= 50) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-600";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConfidenceBadge({ confidence }: { confidence?: number }) {
  if (confidence === undefined) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
        getConfidenceBg(confidence),
      )}
    >
      {confidence}%
    </span>
  );
}

function FileAttachment({
  file,
  onActionClick,
}: {
  file: FocusReasoningFile;
  onActionClick?: (action: FocusAction) => void;
}) {
  const canOpen = Boolean(file.path || file.url);
  const className =
    "flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 mt-1 max-w-full";
  const content = (
    <>
      <RemixIcon
        name="file_text"
        size="size-4"
        className="text-muted-foreground shrink-0"
      />
      <span className="text-sm font-medium text-muted-foreground truncate">
        {file.name}
      </span>
    </>
  );

  if (!onActionClick || !canOpen) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={cn(className, "hover:border-primary/40 hover:bg-surface")}
      onClick={() =>
        onActionClick({
          id: `reasoning-file:${file.path ?? file.url ?? file.name}`,
          type: "open_file",
          label: file.name,
          requiresConfirmation: false,
          params: {
            path: file.path ?? file.url,
            url: file.url,
            name: file.name,
            type: file.type,
          },
        })
      }
    >
      {content}
    </button>
  );
}

function LinkAttachment({
  link,
  onActionClick,
}: {
  link: FocusSourceLink;
  onActionClick?: (action: FocusAction) => void;
}) {
  const className =
    "flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 mt-1 max-w-full";
  const content = (
    <>
      <RemixIcon
        name="link"
        size="size-4"
        className="text-muted-foreground shrink-0"
      />
      <span className="text-sm font-medium text-muted-foreground truncate">
        {link.label}
      </span>
    </>
  );

  if (!onActionClick) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={cn(className, "hover:border-primary/40 hover:bg-surface")}
      onClick={() =>
        onActionClick({
          id: `reasoning-link:${link.url}`,
          type: "open_link",
          label: link.label,
          requiresConfirmation: false,
          params: { url: link.url },
        })
      }
    >
      {content}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * Accordion-style reasoning chain display.
 * Shows a timeline of analysis steps with source badges, confidence, and files.
 */
export function ReasoningChainAccordion({
  steps,
  className,
  onActionClick,
}: ReasoningChainAccordionProps) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (!steps || steps.length === 0) return null;

  return (
    <div className={cn("mt-2 border-t border-border/50 pt-2", className)}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <RemixIcon
          name="arrow_right_s"
          size="size-3"
          className={cn(
            "transition-transform duration-200",
            expanded && "rotate-90",
          )}
        />
        <span>
          {t(
            "character.dailyFocusReasoningChain",
            "Reasoning Chain ({{count}})",
            { count: steps.length },
          )}
        </span>
      </button>

      {expanded && (
        <div className="mt-2.5 space-y-0">
          {steps.map((step, idx) => (
            <div
              key={`${step.time}-${step.summary}-${idx}`}
              className="flex items-start"
            >
              {/* Timeline dot + line */}
              <div className="flex shrink-0 flex-col items-center self-stretch">
                <div className="flex h-5 w-6 items-center justify-center">
                  <div
                    className={cn(
                      "size-2 rounded-full border-2",
                      idx === 0
                        ? "border-primary bg-primary/20"
                        : "border-border",
                    )}
                  />
                </div>
                {idx < steps.length - 1 && (
                  <div className="flex-1 min-h-px w-px bg-border" />
                )}
              </div>

              {/* Step content */}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-3.5 pl-2">
                {/* Time + Confidence row */}
                <div className="flex min-h-5 flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatStepTime(step.time, i18n.language)}
                  </span>
                  <ConfidenceBadge confidence={step.confidence} />
                </div>

                {/* Summary */}
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium leading-6 text-muted-foreground-1">
                    {step.summary}
                  </p>
                  <FocusSourceIcon source={step.source} />
                </div>

                {/* Content */}
                {step.content && (
                  <p className="text-sm text-muted-foreground leading-5">
                    {step.content}
                  </p>
                )}

                {/* Raw content (collapsible detail) */}
                {step.rawContent && step.rawContent !== step.content && (
                  <details className="group">
                    <summary className="text-xs text-muted-foreground/70 cursor-pointer hover:text-muted-foreground transition-colors">
                      {t("character.dailyFocusRawContent", "Raw Content")}
                    </summary>
                    <pre className="mt-1 text-xs text-muted-foreground/60 whitespace-pre-wrap break-words bg-surface/50 rounded-md p-2 max-h-[120px] overflow-y-auto">
                      {step.rawContent}
                    </pre>
                  </details>
                )}

                {/* Files */}
                {step.files && step.files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {step.files.map((file) => (
                      <FileAttachment
                        key={`${file.name}-${file.path ?? file.url ?? ""}`}
                        file={file}
                        onActionClick={onActionClick}
                      />
                    ))}
                  </div>
                )}

                {/* Links */}
                {step.links && step.links.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {step.links.map((link) => (
                      <LinkAttachment
                        key={link.url}
                        link={link}
                        onActionClick={onActionClick}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
