"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface MessageReasoningProps {
  isLoading: boolean;
  reasoning: string;
}

/**
 * Message reasoning block: minimal style with > prefix and collapsible content.
 * Shows "> Reasoning..." while loading, "> Reasoning" when complete.
 */
export function MessageReasoning({
  isLoading,
  reasoning,
}: MessageReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { t } = useTranslation();

  return (
    <div className="mt-2 mb-2">
      {/* Header row with > prefix and toggle */}
      <button
        data-testid="message-reasoning-toggle"
        type="button"
        className="flex items-center gap-1.5 cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span
          className={cn(
            "text-sm text-neutral-500 transition-colors",
            isLoading && "animate-pulse",
          )}
        >
          {isLoading ? (
            <>{t("common.reasoningInProgress")}</>
          ) : (
            <>{t("common.reasoningCompleted")}</>
          )}
        </span>
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
            "text-neutral-500 transition-transform duration-200 shrink-0",
            !isExpanded && "-rotate-90",
          )}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            data-testid="message-reasoning"
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pl-3 pt-1.5 text-sm text-neutral-500 whitespace-pre-wrap">
              {reasoning}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
