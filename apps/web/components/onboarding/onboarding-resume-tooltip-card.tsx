"use client";

import { cn } from "@/lib/utils";

type OnboardingResumeTooltipCardProps = {
  message: string;
  imageUrl?: string | null;
  imageAlt?: string;
  className?: string;
};

/**
 * Reusable onboarding resume tooltip card with optional image area and arrow.
 */
export function OnboardingResumeTooltipCard({
  message,
  imageUrl,
  imageAlt = "Onboarding hint",
  className,
}: OnboardingResumeTooltipCardProps) {
  return (
    <div
      className={cn(
        "relative flex w-[260px] min-w-[160px] items-center justify-center rounded-xl border border-border bg-white px-3 py-3 text-center text-xs text-foreground shadow-md",
        className,
      )}
    >
      <div className="flex w-full flex-col items-center justify-center gap-2">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={imageAlt}
            className="h-24 w-full rounded-md object-cover"
          />
        )}
        <p className="text-xs font-normal text-foreground">{message}</p>
      </div>
    </div>
  );
}
