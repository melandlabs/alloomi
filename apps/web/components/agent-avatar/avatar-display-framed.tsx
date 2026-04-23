"use client";

import { memo, useState } from "react";
import { AvatarDisplay } from "./avatar-display";
import type { AvatarConfiguration } from "./types";

/**
 * Circular frame avatar props.
 */
interface AvatarDisplayFramedProps {
  /** Avatar configuration */
  config: AvatarConfiguration;
  /** Size class for the outer framed container */
  className?: string;
  /** Download callback passthrough */
  onDownloadRef?: (fn: () => void) => void;
  /** Interaction toggle passthrough */
  enableInteractions?: boolean;
  /** Static low-cost mode: centered, no hover tracking, no blinking */
  staticMode?: boolean;
  /** Keep avatar centered (used by selected state in cards) */
  forceCenter?: boolean;
  /** Default to bottom-right offset, center on hover/forceCenter */
  defaultBottomRight?: boolean;
  /** Size class for the inner avatar renderer */
  avatarClassName?: string;
  /** Additional class names for the inner translation wrapper */
  innerClassName?: string;
  /** Class name for avatar background SVG scale wrapper */
  backgroundScaleClassName?: string;
  /** Class name for avatar facial-features SVG scale wrapper */
  featureScaleClassName?: string;
  /** Whether overflowing avatar content should be clipped by the frame */
  overflowHidden?: boolean;
}

/**
 * Avatar display wrapped by a circular frame.
 * Clips avatar rendering inside a round viewport and keeps the existing avatar internals unchanged.
 */
export const AvatarDisplayFramed = memo(function AvatarDisplayFramed({
  config,
  className,
  onDownloadRef,
  enableInteractions = true,
  staticMode = false,
  forceCenter = false,
  defaultBottomRight = false,
  avatarClassName,
  innerClassName,
  backgroundScaleClassName,
  featureScaleClassName,
  overflowHidden = true,
}: AvatarDisplayFramedProps) {
  const [isHovered, setIsHovered] = useState(false);
  const shouldTrack = enableInteractions && !staticMode && isHovered;
  const shouldBlink = !staticMode;
  const shouldCenter =
    staticMode || forceCenter || isHovered || !defaultBottomRight;

  return (
    <div
      className={`relative aspect-square rounded-full bg-background ${
        overflowHidden ? "overflow-hidden" : "overflow-visible"
      } ${className ?? "w-[120px]"}`}
      role="img"
      aria-label="Avatar preview"
      onMouseEnter={staticMode ? undefined : () => setIsHovered(true)}
      onMouseLeave={staticMode ? undefined : () => setIsHovered(false)}
    >
      {/* Character cards can use bottom-right default and center on hover/selected. */}
      <div
        className={`size-full flex items-center justify-center transition-transform duration-300 ease-out ${
          shouldCenter
            ? "translate-x-0 translate-y-0"
            : "translate-x-[14%] translate-y-[14%]"
        } ${innerClassName ?? ""}`}
      >
        <AvatarDisplay
          config={config}
          className={avatarClassName ?? "size-[250%]"}
          onDownloadRef={onDownloadRef}
          enableInteractions={enableInteractions}
          enableBlinking={shouldBlink}
          enableGazeTracking={shouldTrack}
          backgroundScaleClassName={backgroundScaleClassName}
          featureScaleClassName={featureScaleClassName}
        />
      </div>
    </div>
  );
});
