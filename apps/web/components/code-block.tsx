"use client";

import React, { memo, useState, useCallback } from "react";
import { RemixIcon } from "./remix-icon";

interface CodeBlockProps {
  node: any;
  inline?: boolean;
  className?: string;
  children: any;
}

function CodeBlockImpl({
  node,
  inline,
  className,
  children,
  ...props
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  // Check if children is already a React element (e.g., <code> from markdown)
  const isReactElement = React.isValidElement(children);

  const handleCopy = useCallback(() => {
    const code = extractText(children);
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [children]);

  if (!inline) {
    return (
      <div className="not-prose flex flex-col min-w-0">
        <div className="relative group">
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            title={copied ? "Copied!" : "Copy code"}
          >
            <RemixIcon
              name={copied ? "check" : "copy"}
              size="size-4"
              className={
                copied
                  ? "text-green-600 dark:text-green-400"
                  : "text-zinc-600 dark:text-zinc-400"
              }
            />
          </button>
          <pre
            {...props}
            className={
              "text-sm w-full overflow-x-auto dark:bg-zinc-900 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl dark:text-zinc-50 text-zinc-900"
            }
          >
            {isReactElement ? (
              children
            ) : (
              <code className="whitespace-pre font-mono min-w-0">
                {children}
              </code>
            )}
          </pre>
        </div>
      </div>
    );
  }
  return (
    <code
      className={`${className} text-sm bg-zinc-100 dark:bg-zinc-800 py-0.5 px-1 rounded-md`}
      {...props}
    >
      {children}
    </code>
  );
}

function extractText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return extractText(
      (children as { props: { children?: React.ReactNode } }).props.children,
    );
  }
  return "";
}

// rerender-memo: use memo to avoid unnecessary re-renders
export const CodeBlock = memo(CodeBlockImpl);
