"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { isImageFile } from "@/components/file-icons";
import { getToolDisplayName } from "@/lib/utils/tool-names";

interface NativeToolCallProps {
  toolName: string;
  status?: string;
  toolOutput?: any;
  generatedFile?: {
    path: string;
    name: string;
    type: string;
  };
  codeFile?: {
    path: string;
    name: string;
    language: string;
  };
  toolInput?: any;
  onPreviewFile?: (file: {
    path: string;
    name: string;
    type: string;
    taskId?: string;
  }) => void;
  // Optional prop to disable collapse (when managed by accordion)
  disableCollapse?: boolean;
  // External executing state based on text content after tool call
  isExecuting?: boolean;
  /** When true, rendered as a sub-item inside an Accordion, without outer rounded border */
  embeddedInAccordion?: boolean;
  /** taskId (chatId) for resolving file paths in FilePreviewPanel */
  taskId?: string;
  /** Whether the user has any connected integration accounts.
   * When true and tool fails, shows "Connect Account" button.
   */
  hasConnectedAccounts?: boolean;
}

/**
 * Strip ANSI escape sequences from text
 * Removes color codes and other terminal formatting that shouldn't appear in web UI
 */
function stripAnsi(text: string): string {
  const ESC = String.fromCharCode(27);
  const ansiRegex = new RegExp(`(${ESC}\\[[0-9;]*m|\\[[0-9;]*m)`, "g");
  return text.replace(ansiRegex, "");
}

export function NativeToolCall({
  toolName,
  status,
  toolOutput,
  generatedFile,
  codeFile,
  toolInput,
  onPreviewFile,
  disableCollapse = false,
  isExecuting: externalIsExecuting,
  embeddedInAccordion = false,
  hasConnectedAccounts = true,
  taskId,
}: NativeToolCallProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const isCompleted = status === "completed";
  const isInternalExecuting = status === "executing";
  const isError = status === "error";
  // Prefer external isExecuting state (based on text content after tool call), otherwise use internal state
  const isExecuting = externalIsExecuting || isInternalExecuting;

  // Text gradient animation during execution - light gray
  const executingTextStyle = isExecuting
    ? {
        background:
          "linear-gradient(90deg, #9ca3af 0%, #d1d5db 50%, #9ca3af 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 3s linear infinite",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }
    : undefined;

  const formatToolParams = () => {
    if (!toolInput || !toolName) return null;

    // Extract tool name without prefix
    const toolNameStr = toolName as string;
    const toolNameWithoutPrefix = toolNameStr.includes("__")
      ? toolNameStr.split("__").pop() || toolNameStr
      : toolNameStr;

    let paramText = "";

    if (toolNameWithoutPrefix === "Bash" && toolInput.command) {
      paramText = toolInput.command;
    } else if (toolNameWithoutPrefix === "WebSearch" && toolInput.query) {
      paramText = toolInput.query;
    } else if (toolNameWithoutPrefix === "TodoWrite" && toolInput.todos) {
      const todos = toolInput.todos;
      if (Array.isArray(todos)) {
        const count = todos.length;
        const pending = todos.filter((t: any) => t.status === "pending").length;
        paramText = t("common.nativeToolCall.taskCount", { count, pending });
      }
    } else if (
      (toolNameWithoutPrefix === "Read" || toolNameWithoutPrefix === "Edit") &&
      toolInput.file_path
    ) {
      paramText = toolInput.file_path;
    } else if (
      (toolNameWithoutPrefix === "chatInsight" ||
        toolNameWithoutPrefix === "searchKnowledgeBase" ||
        toolNameWithoutPrefix === "getRawMessages" ||
        toolNameWithoutPrefix === "searchRawMessages") &&
      toolInput.query
    ) {
      paramText = toolInput.query;
    } else if (
      toolNameWithoutPrefix === "chatInsight" &&
      toolInput.filterDefinition
    ) {
      paramText = "filter";
    } else if (
      (toolNameWithoutPrefix === "getRawMessages" ||
        toolNameWithoutPrefix === "searchRawMessages") &&
      Array.isArray(toolInput.keywords)
    ) {
      paramText = toolInput.keywords.join(", ");
    } else if (toolNameWithoutPrefix === "Skill" && toolInput.skill) {
      // Skill tool: display skill name
      paramText = toolInput.skill;
    } else if (toolNameWithoutPrefix === "Skill" && toolInput.args) {
      // Alternative: skill name might be in args
      paramText =
        typeof toolInput.args === "string"
          ? toolInput.args
          : JSON.stringify(toolInput.args).slice(0, 60);
    } else {
      // Try to convert other parameters to string
      try {
        const jsonStr = JSON.stringify(toolInput);
        if (jsonStr && jsonStr !== "{}") {
          paramText = jsonStr;
        }
      } catch (e) {
        // Ignore
      }
    }

    // Truncate parameters
    if (paramText && paramText.length > 80) {
      paramText = `${paramText.substring(0, 80)}...`;
    }

    return paramText || null;
  };

  const formatToolOutput = () => {
    if (!toolOutput || !toolName) return null;

    // Extract tool name without prefix
    const toolNameWithoutPrefix = (toolName as string).includes("__")
      ? (toolName as string).split("__").pop() || toolName
      : toolName;

    if (toolNameWithoutPrefix === "WebSearch") {
      try {
        const output =
          typeof toolOutput === "string" ? JSON.parse(toolOutput) : toolOutput;
        if (
          output.results &&
          Array.isArray(output.results) &&
          output.results.length > 0
        ) {
          return t("common.nativeToolCall.searchResults", {
            count: output.results.length,
          });
        }
      } catch (e) {
        // Ignore
      }
    }

    if (toolNameWithoutPrefix === "TodoWrite") {
      try {
        const output =
          typeof toolOutput === "string" ? JSON.parse(toolOutput) : toolOutput;
        if (output.todos && Array.isArray(output.todos)) {
          return t("common.nativeToolCall.tasksUpdated", {
            count: output.todos.length,
          });
        }
      } catch (e) {
        // Ignore
      }
    }

    return null;
  };

  // Format detailed content
  const formatDetailedContent = () => {
    const contents: React.ReactNode[] = [];

    // Display Bash command
    if (toolName === "Bash" && toolInput?.command) {
      contents.push(
        <div
          key="bash"
          className="mt-0.5 px-2 py-1 bg-black/80 text-green-400 rounded text-xs font-mono"
        >
          <span className="text-gray-500">$</span> {toolInput.command}
        </div>,
      );
    }

    // Display WebSearch query
    if (toolName === "WebSearch" && toolInput?.query) {
      contents.push(
        <div
          key="search"
          className="mt-0.5 px-2 py-1 bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 rounded text-xs"
        >
          🔎 "{toolInput.query}"
        </div>,
      );
    }

    // Display file path
    if ((toolName === "Read" || toolName === "Edit") && toolInput?.file_path) {
      const filePath = toolInput.file_path;
      const isImage = isImageFile(filePath);

      contents.push(
        <div key="file" className="mt-0.5 space-y-0.5">
          <div className="px-2 py-1 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs font-mono">
            📁 {filePath}
          </div>
          {isImage && toolName === "Read" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const fileName = filePath.split("/").pop() || "";
                const fileExt = fileName.slice(fileName.lastIndexOf(".") + 1);
                onPreviewFile?.({
                  path: filePath,
                  name: fileName,
                  type: fileExt,
                  taskId,
                });
              }}
              className="shrink-0 ml-1 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
              title={t("common.previewImage", "Preview")}
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
          )}
        </div>,
      );
    }

    // Display TodoWrite detailed content
    if (
      toolName === "TodoWrite" &&
      toolInput?.todos &&
      Array.isArray(toolInput.todos)
    ) {
      contents.push(
        <div key="todos" className="mt-0.5 space-y-0.5">
          {toolInput.todos.map((todo: any) => (
            <div
              key={todo.content || todo.activeForm}
              className="flex items-start gap-1.5 text-xs"
            >
              <span
                className={cn(
                  "mt-0.5 size-1.5 shrink-0 rounded-full",
                  todo.status === "completed"
                    ? "bg-emerald-500"
                    : todo.status === "in_progress"
                      ? "bg-amber-500 animate-pulse"
                      : "bg-muted-foreground",
                )}
              />
              <span
                className={cn(
                  todo.status === "completed"
                    ? "line-through text-muted-foreground"
                    : "",
                )}
              >
                {todo.content || todo.activeForm}
              </span>
            </div>
          ))}
        </div>,
      );
    }

    // Display tool output
    if (toolOutput && typeof toolOutput === "string") {
      // Strip ANSI escape sequences before displaying
      const cleanOutput = stripAnsi(toolOutput);

      // For very long output, display truncated version with option to view full content
      const shouldTruncate = cleanOutput.length > 500;

      contents.push(
        <div
          key="output"
          className="mt-0.5 p-2 bg-gray-50/80 dark:bg-black/30 rounded text-xs font-mono max-h-[500px] overflow-y-auto border border-gray-100 dark:border-gray-800"
        >
          <pre className="whitespace-pre-wrap break-all">
            {shouldTruncate
              ? `${cleanOutput.substring(0, 500)}\n\n... (output truncated, ${cleanOutput.length - 5000} more characters)`
              : cleanOutput}
          </pre>
        </div>,
      );
    }

    return contents.length > 0 ? contents : null;
  };

  const params = formatToolParams();
  const output = formatToolOutput();
  const detailedContent = formatDetailedContent();
  /** Only show expand button when there is actually content to display after expansion */
  const hasDetails = !!detailedContent && !disableCollapse;

  // Tool icon based on tool type - MiniMax style: more subtle
  const getToolIcon = () => {
    if (!toolName) return null;

    const toolNameStr = toolName as string;
    const toolNameWithoutPrefix = toolNameStr.includes("__")
      ? toolNameStr.split("__").pop() || toolNameStr
      : toolNameStr;

    if (toolNameWithoutPrefix === "WebSearch") {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    }

    if (isCompleted) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    }

    if (isError) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-destructive"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="8" y2="12" />
          <line x1="12" x2="12.01" y1="16" y2="16" />
        </svg>
      );
    }

    if (isExecuting) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber-500 animate-spin"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      );
    }

    // Default icon for pending/unknown status
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" x2="12" y1="16" y2="12" />
        <line x1="12" x2="12.01" y1="8" y2="8" />
      </svg>
    );
  };

  const wrapperClassName = embeddedInAccordion
    ? undefined
    : "rounded-lg border border-border bg-card/50";

  return (
    <div className={wrapperClassName}>
      <div
        role="button"
        tabIndex={hasDetails ? 0 : undefined}
        className={cn(
          "group flex flex-col gap-0 px-3 py-2 rounded-md",
          hasDetails && "cursor-pointer transition-colors",
        )}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (hasDetails && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        {/* First row: tool icon + tool name/params + expand arrow */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
            {getToolIcon()}
          </div>

          <div className="min-w-0 flex-1 flex items-center gap-1.5">
            <p
              className="text-sm text-muted-foreground group-hover:text-foreground transition-colors min-w-0 leading-relaxed"
              style={executingTextStyle}
            >
              <span className={isExecuting ? "" : undefined}>
                {isExecuting
                  ? `${t("common.nativeToolCall.executing", "Executing tool")} ${getToolDisplayName(toolName, t)}`
                  : getToolDisplayName(toolName, t)}
              </span>
              {params && (
                <>
                  <span className="text-muted-foreground/80 group-hover:text-foreground/80 mx-1">
                    ·
                  </span>
                  <span className="text-muted-foreground group-hover:text-foreground text-xs font-mono">
                    {params}
                  </span>
                </>
              )}
            </p>
            {hasDetails && (
              <span className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
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
                  className={cn(
                    "transition-transform",
                    !isExpanded && "-rotate-90",
                  )}
                  aria-hidden
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            )}
          </div>
        </div>

        {/* Second row: file info (displayed on a new line) */}
        {(generatedFile || codeFile) && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors pl-[22px]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="truncate min-w-0">
              {generatedFile?.name || codeFile?.name}
            </span>
            <span className="text-muted-foreground/70 truncate min-w-0 hidden sm:inline">
              {generatedFile ? generatedFile.path : codeFile?.path}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const fileToPreview = generatedFile || codeFile || ({} as any);
                onPreviewFile?.({ ...fileToPreview, taskId });
              }}
              className="shrink-0 ml-1 p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors"
              title={t("common.nativeToolCall.previewFile", "Preview")}
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
                className="text-muted-foreground"
              >
                <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Expanded content is displayed below, not on the right side */}
      {(isExpanded || disableCollapse) && detailedContent && (
        <div className="border-t border-border/60 pt-2 pb-2 px-2 mt-0">
          {detailedContent}
        </div>
      )}
    </div>
  );
}
