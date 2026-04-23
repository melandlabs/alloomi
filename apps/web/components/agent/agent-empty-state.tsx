"use client";

import type { ReactNode } from "react";
import { AvatarDisplay } from "@/components/agent-avatar";
import type { AvatarConfiguration } from "@/components/agent-avatar/types";
import { cn } from "@/lib/utils";

/**
 * Generic empty state component Props
 * Layout: Top AI avatar (optional) / Middle text / Bottom button (optional)
 */
export interface AgentEmptyStateProps {
  /**
   * AI avatar configuration, renders AvatarDisplay when passed; mutually exclusive with avatar
   */
  avatarConfig?: AvatarConfiguration | null;
  /**
   * Avatar container className, e.g. size-48
   */
  avatarClassName?: string;
  /**
   * Custom top area (icons, etc.), mutually exclusive with avatarConfig; used for non-AI avatar scenarios (e.g. Target icon for focus card)
   */
  avatar?: ReactNode;
  /**
   * Middle text area
   */
  children: ReactNode;
  /**
   * Bottom action button area, not shown if not passed
   */
  action?: ReactNode;
  /**
   * Root container className
   */
  className?: string;
}

/**
 * Generic empty state component
 * Structure: Top AI avatar (or custom avatar) → Middle text → Bottom optional button
 * Each page customizes display by passing avatarConfig/avatar, children, action
 */
export function AgentEmptyState({
  avatarConfig,
  avatarClassName = "size-48",
  avatar,
  children,
  action,
  className,
}: AgentEmptyStateProps) {
  const showAvatarBlock = avatarConfig != null || avatar != null;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-8",
        className,
      )}
    >
      {showAvatarBlock && (
        <div className="flex shrink-0">
          {avatarConfig != null ? (
            <AvatarDisplay
              config={avatarConfig}
              className={avatarClassName}
              enableInteractions={true}
            />
          ) : (
            avatar
          )}
        </div>
      )}
      <div className="text-center text-muted-foreground space-y-1 min-w-0">
        {children}
      </div>
      {action != null && <div className="flex shrink-0">{action}</div>}
    </div>
  );
}
