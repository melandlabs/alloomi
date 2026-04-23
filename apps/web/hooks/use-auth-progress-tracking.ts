import { useRef, useEffect, useCallback } from "react";

interface UseAuthProgressTrackingOptions {
  platform: string;
  isOpen: boolean;
  method?: string;
  isReconnect?: boolean;
}

interface UseAuthProgressTrackingReturn {
  trackStepChange: (step: string) => void;
  trackClose: (extraData?: Record<string, unknown>) => void;
  trackSuccess: (extraData?: Record<string, unknown>) => void;
  trackError: (
    error: Error | string,
    extraData?: Record<string, unknown>,
  ) => void;
}

/**
 * Authorization flow progress tracking Hook
 * Used to track user behavior and experience metrics during authorization flow
 */
export function useAuthProgressTracking({
  platform,
  isOpen,
  method = "default",
  isReconnect = false,
}: UseAuthProgressTrackingOptions): UseAuthProgressTrackingReturn {
  const sessionStartTimeRef = useRef<number>(Date.now());
  const stepStartTimeRef = useRef<number>(Date.now());
  const previousStepRef = useRef<string>("");
  const currentStepRef = useRef<string>("");

  // ========================================
  // Track modal opened
  // ========================================
  useEffect(() => {
    if (isOpen) {
      // Reset timer
      sessionStartTimeRef.current = Date.now();
      stepStartTimeRef.current = Date.now();
      previousStepRef.current = "";
      currentStepRef.current = "";
    }
  }, [isOpen, platform, method, isReconnect]);

  // ========================================
  // Track step changes
  // ========================================
  const trackStepChange = useCallback(
    (newStep: string) => {
      if (!isOpen) return;

      const now = Date.now();
      const stepDuration = now - stepStartTimeRef.current;

      // Record duration of previous step
      if (previousStepRef.current && previousStepRef.current !== newStep) {
      }

      // Record new step view

      previousStepRef.current = currentStepRef.current;
      currentStepRef.current = newStep;
      stepStartTimeRef.current = now;
    },
    [isOpen, platform, method],
  );

  // ========================================
  // Track modal close
  // ========================================
  const trackClose = useCallback(
    (extraData: Record<string, unknown> = {}) => {
      const totalDuration = Date.now() - sessionStartTimeRef.current;

      // Reset
      sessionStartTimeRef.current = Date.now();
      stepStartTimeRef.current = Date.now();
      previousStepRef.current = "";
      currentStepRef.current = "";
    },
    [platform, method],
  );

  // ========================================
  // Track authorization success
  // ========================================
  const trackSuccess = useCallback(
    (extraData: Record<string, unknown> = {}) => {
      const totalDuration = Date.now() - sessionStartTimeRef.current;
    },
    [platform, method],
  );

  // ========================================
  // Track authorization failure
  // ========================================
  const trackError = useCallback(
    (error: Error | string, extraData: Record<string, unknown> = {}) => {
      const totalDuration = Date.now() - sessionStartTimeRef.current;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
    },
    [platform, method],
  );

  return {
    trackStepChange,
    trackClose,
    trackSuccess,
    trackError,
  };
}
