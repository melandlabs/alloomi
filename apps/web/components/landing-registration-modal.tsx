"use client";

import { useState } from "react";
import { RemixIcon } from "@/components/remix-icon";
import { FaDiscord } from "react-icons/fa";
import { openUrl } from "@/lib/tauri";

type VerificationStatus = "idle" | "verifying" | "verified" | "error";

type Step = "register" | "success" | "discord-optional";

interface LandingRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: {
    email: string;
    referralCode: string;
    expiresAt: string;
  }) => void;
  defaultReferralCode?: string;
  trackingParams?: Record<string, string>;
}

/**
 * Registration modal for claiming 6 months free Pro membership
 */
export function LandingRegistrationModal({
  isOpen,
  onClose,
  onSuccess,
  defaultReferralCode,
  trackingParams = {},
}: LandingRegistrationModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>("register");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState(defaultReferralCode ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{
    email: string;
    referralCode: string;
    expiresAt: string;
  } | null>(null);

  // Discord verification state (now optional)
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>("idle");

  // Discord verification handler (now optional)
  const handleDiscordVerify = async () => {
    setVerificationStatus("verifying");
    setError(null);

    // Open Discord invite link in new tab
    openUrl("https://discord.gg/xkJaJyWcsv");

    // Simulate verification delay for better UX
    setTimeout(() => {
      setVerificationStatus("verified");
    }, 800);
  };

  // Skip Discord handler
  const handleSkipDiscord = () => {
    setCurrentStep("register");
    setVerificationStatus("idle");
  };

  const handleClose = () => {
    if (!isLoading) {
      // Track modal close
      onClose();
      // Reset form after close animation
      setTimeout(() => {
        setCurrentStep("register");
        setEmail("");
        setName("");
        setPassword("");
        setReferralCode(defaultReferralCode ?? "");
        setError(null);
        setSuccess(false);
        setSuccessData(null);
        // Reset Discord verification
        setVerificationStatus("idle");
      }, 300);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Track registration submission attempt

    try {
      const response = await fetch("/api/landing/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          name: name || undefined,
          password: password || undefined,
          referralCode: referralCode || undefined,
          trackingParams,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        const resultData = {
          email,
          referralCode: data.referralCode,
          expiresAt: data.expiresAt,
        };
        setSuccessData(resultData);

        // Track registration success

        onSuccess?.(resultData);
      } else {
        setError(data.error || data.message || "Registration failed");

        // Track registration failure
      }
    } catch (err) {
      setError("Network error. Please try again.");

      // Track network error
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Close modal"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleClose();
          }
        }}
      />

      {/* Modal: hide right-side scrollbar */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto no-scrollbar animate-in fade-in zoom-in duration-300">
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
        >
          <RemixIcon name="close" size="size-5" />
        </button>

        {/* Success State */}
        {success && successData ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <RemixIcon
                name="check"
                size="size-8"
                className="text-green-600"
              />
            </div>

            <h2 className="text-2xl font-bold text-deepwater mb-4">
              Congratulations! 🎉
            </h2>

            <p className="text-foreground-secondary mb-6">
              You've successfully claimed{" "}
              <span className="font-semibold text-deepwater">
                6 months of Pro membership
              </span>
              !
            </p>

            <div className="bg-deepwater/5 rounded-2xl p-4 mb-6 text-left space-y-3">
              <div className="flex items-start gap-3">
                <RemixIcon
                  name="mail"
                  size="size-5"
                  className="text-deepwater mt-0.5 flex-shrink-0"
                />
                <div>
                  <p className="text-sm text-foreground-muted">Email</p>
                  <p className="font-medium text-foreground">
                    {successData.email}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <RemixIcon
                  name="magic"
                  size="size-5"
                  className="text-deepwater mt-0.5 flex-shrink-0"
                />
                <div>
                  <p className="text-sm text-foreground-muted">Valid until</p>
                  <p className="font-medium text-foreground">
                    {new Date(successData.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {successData.referralCode && (
                <div className="flex items-start gap-3">
                  <RemixIcon
                    name="user"
                    size="size-5"
                    className="text-deepwater mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <p className="text-sm text-foreground-muted">
                      Your referral code
                    </p>
                    <p className="font-mono font-semibold text-deepwater bg-white rounded-lg p-2 mt-1">
                      {successData.referralCode}
                    </p>
                    <p className="text-xs text-foreground-muted mt-1">
                      Share with friends! After 3 referrals, get another 6
                      months free.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled
              className="w-full bg-gold text-white px-8 py-4 rounded-full text-base font-bold transition-all cursor-not-allowed shadow-md border-2 border-gold mb-3"
            >
              Coming Soon
            </button>

            <div className="text-center mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-foreground-muted mb-3">
                Want to connect with our community?
              </p>
              <button
                type="button"
                onClick={handleDiscordVerify}
                disabled={verificationStatus === "verifying"}
                className="w-full bg-[#5865F2] text-white px-6 py-3 rounded-full font-medium hover:scale-105 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <FaDiscord className="w-5 h-5" />
                {verificationStatus === "verifying"
                  ? "Opening..."
                  : "Join Discord Community (Optional)"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header: only title, left-aligned */}
            <div className="p-6 pb-4 text-left border-b border-border-primary">
              <h2 className="text-2xl font-bold text-foreground">
                Claim Your 6 Months Free Pro
              </h2>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-8">
              <div className="space-y-4">
                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <RemixIcon
                      name="mail"
                      size="size-5"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                    />
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 border border-border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-deepwater/20 focus:border-deepwater transition-all"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Name (optional) */}
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Name{" "}
                    <span className="text-foreground-muted">(optional)</span>
                  </label>
                  <div className="relative">
                    <RemixIcon
                      name="user"
                      size="size-5"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                    />
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full pl-10 pr-4 py-3 border border-border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-deepwater/20 focus:border-deepwater transition-all"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Password (for new users) */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <RemixIcon
                      name="lock"
                      size="size-5"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                    />
                    <input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      minLength={8}
                      className="w-full pl-10 pr-4 py-3 border border-border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-deepwater/20 focus:border-deepwater transition-all"
                      disabled={isLoading}
                    />
                  </div>
                  <p className="text-xs text-foreground-muted mt-1">
                    Min. 8 characters
                  </p>
                </div>

                {/* Referral Code (optional) */}
                {defaultReferralCode ? (
                  <div>
                    <label
                      htmlFor="referralCode"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Referral Code{" "}
                      <span className="text-green-600">(applied)</span>
                    </label>
                    <div className="relative">
                      <RemixIcon
                        name="user"
                        size="size-5"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600"
                      />
                      <input
                        id="referralCode"
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border-2 border-green-500 bg-green-50 rounded-xl font-mono"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="referralCode"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Referral Code{" "}
                      <span className="text-foreground-muted">(optional)</span>
                    </label>
                    <div className="relative">
                      <RemixIcon
                        name="user"
                        size="size-5"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                      />
                      <input
                        id="referralCode"
                        type="text"
                        value={referralCode}
                        onChange={(e) =>
                          setReferralCode(e.target.value.toUpperCase())
                        }
                        placeholder="REFERRAL_CODE"
                        className="w-full pl-10 pr-4 py-3 border border-border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-deepwater/20 focus:border-deepwater transition-all font-mono uppercase"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <RemixIcon
                      name="error_warning"
                      size="size-5"
                      className="text-red-600 flex-shrink-0 mt-0.5"
                    />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Submit button: gold, consistent with CTA */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-6 bg-gold text-white px-8 py-4 rounded-full text-base font-bold hover:scale-105 transition-all cursor-pointer shadow-md hover:shadow-lg border-2 border-gold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RemixIcon name="magic" size="size-5" />
                      Sign Up Now!
                    </>
                  )}
                </button>

                {/* Terms */}
                <p className="text-xs text-foreground-muted text-center">
                  By claiming this offer, you agree to our{" "}
                  <button
                    type="button"
                    onClick={(e: any) => {
                      e.preventDefault();
                    }}
                    className="text-deepwater cursor-not-allowed bg-transparent border-0 p-0 text-sm hover:underline"
                  >
                    Terms of Service
                  </button>{" "}
                  and{" "}
                  <button
                    type="button"
                    onClick={(e: any) => {
                      e.preventDefault();
                    }}
                    className="text-deepwater cursor-not-allowed bg-transparent border-0 p-0 text-sm hover:underline"
                  >
                    Privacy Policy
                  </button>
                </p>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
