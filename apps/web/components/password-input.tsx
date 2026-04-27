"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

interface PasswordInputProps {
  toolUseID: string;
  originalCommand: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

export function PasswordInput({
  toolUseID,
  originalCommand,
  onSubmit,
  onCancel,
}: PasswordInputProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [countdown, setCountdown] = useState(45);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Countdown timer
  useEffect(() => {
    timeoutRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timeoutRef.current) {
            clearInterval(timeoutRef.current);
          }
          onCancel();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
      }
    };
  }, [onCancel]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(password);
    },
    [password, onSubmit],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [onCancel],
  );

  return (
    <div className="mt-3 rounded-lg border border-border bg-card/50 overflow-hidden">
      {/* Header - Unicode box style */}
      <div className="bg-black/90 px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-amber-400">🔐</span>
          <span className="font-medium text-white">
            {t("passwordInput.title", "SUDO PASSWORD REQUIRED")}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="px-3 py-2 border-t border-border/60">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            {t(
              "passwordInput.instructions",
              "Enter password below (input is hidden), or:",
            )}
          </p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>
              {t(
                "passwordInput.optionSkip",
                "Press Enter to skip (command fails gracefully)",
              )}
            </li>
            <li>
              {t("passwordInput.optionTimeout", {
                countdown,
                defaultValue: `Wait ${countdown}s to auto-skip`,
              })}
            </li>
          </ul>
        </div>
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="px-3 py-2 border-t border-border/60 flex items-center gap-2"
      >
        <label
          htmlFor="password-input"
          className="text-xs text-muted-foreground shrink-0"
        >
          {t("passwordInput.passwordLabel", "Password (hidden):")}
        </label>
        <input
          id="password-input"
          ref={inputRef}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 px-2 py-1 text-xs font-mono bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder={t("passwordInput.placeholder", "Enter password...")}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors"
        >
          {t("passwordInput.cancel", "Cancel")}
        </button>
        <button
          type="submit"
          className="shrink-0 px-3 py-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded transition-colors"
        >
          {t("passwordInput.submit", "Submit")}
        </button>
      </form>

      {/* Original command preview */}
      {originalCommand && (
        <div className="px-3 py-2 border-t border-border/60 bg-muted/30">
          <div className="text-xs font-mono text-muted-foreground truncate">
            {t("passwordInput.command", "Command:")} {originalCommand}
          </div>
        </div>
      )}
    </div>
  );
}
