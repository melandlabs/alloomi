"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  max?: number;
  min?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      value,
      onValueChange,
      max = 100,
      min = 0,
      step = 1,
      className,
      disabled,
      ariaLabel,
    },
    ref,
  ) => {
    const trackRef = React.useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = React.useState(false);

    const percentage = ((value[0] - min) / (max - min)) * 100;
    const clampedPercentage = Math.max(0, Math.min(100, percentage));

    const handleMouseDown = (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      setIsDragging(true);
      updateValue(e.clientX);
    };

    const handleMouseMove = React.useCallback(
      (e: MouseEvent) => {
        if (!isDragging || disabled) return;
        updateValue(e.clientX);
      },
      [isDragging, disabled],
    );

    const handleMouseUp = React.useCallback(() => {
      setIsDragging(false);
    }, []);

    const updateValue = (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const rawValue = min + percent * (max - min);
      const steppedValue = Math.round(rawValue / step) * step;
      const clampedValue = Math.max(min, Math.min(max, steppedValue));
      onValueChange([clampedValue]);
    };

    React.useEffect(() => {
      if (isDragging) {
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
        };
      }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
      <div
        ref={ref}
        role="slider"
        aria-label={ariaLabel}
        aria-valuenow={Math.round(value[0])}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={disabled ? undefined : 0}
        className={cn(
          "relative flex items-center w-full h-5 cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
        onMouseDown={handleMouseDown}
      >
        <div
          ref={trackRef}
          className="relative h-1 w-full grow overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700"
        >
          <div
            className="h-full bg-neutral-900 dark:bg-neutral-100 rounded-full"
            style={{ width: `${clampedPercentage}%` }}
          />
        </div>
        <div
          className={cn(
            "absolute h-4 w-4 rounded-full border border-neutral-900/50 dark:border-neutral-100/50 bg-white dark:bg-neutral-900 shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 dark:focus-visible:ring-neutral-100",
            isDragging && "scale-110",
          )}
          style={{ left: `calc(${clampedPercentage}% - 8px)` }}
        />
      </div>
    );
  },
);

Slider.displayName = "Slider";
