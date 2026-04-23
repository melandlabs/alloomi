import "server-only";

import { createTransport } from "nodemailer";

import { getApplicationBaseUrl } from "@/lib/env";

const SMTP_HOST = process.env.AUTH_SMTP_HOST;
const SMTP_PORT = process.env.AUTH_SMTP_PORT;
const SMTP_USER = process.env.AUTH_SMTP_USER;
const SMTP_PASS = process.env.AUTH_SMTP_PASSWORD || process.env.AUTH_SMTP_PASS;
const SMTP_SECURE = process.env.AUTH_SMTP_SECURE;
const EMAIL_FROM = process.env.AUTH_EMAIL_FROM || process.env.AUTH_SMTP_FROM;

function isEmailConfigured() {
  return Boolean(
    SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && EMAIL_FROM,
  );
}

export function isPasswordResetEmailConfigured() {
  return isEmailConfigured();
}

function getTransport() {
  if (!isEmailConfigured()) {
    return null;
  }

  const port = Number.parseInt(SMTP_PORT ?? "0", 10);
  const secure = SMTP_SECURE ? SMTP_SECURE === "true" : port === 465;

  return createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
}

type PasswordResetResult = {
  resetUrl: string;
  delivered: boolean;
  reason?: "smtp_not_configured" | "send_failed";
};

export async function sendPasswordResetEmail({
  to,
  token,
}: {
  to: string;
  token: string;
}): Promise<PasswordResetResult> {
  const resetUrl = `${getApplicationBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  const transport = getTransport();

  if (!transport) {
    console.warn(
      `[PasswordResetEmail] SMTP details missing. Generated link for ${to}: ${resetUrl}`,
    );
    return { resetUrl, delivered: false, reason: "smtp_not_configured" };
  }

  try {
    await transport.sendMail({
      from: EMAIL_FROM,
      to,
      subject: "Reset your password",
      text: `Hi there!\n\nWe received a request to reset the password for your account.\n\nUse the link below to set a new password. This link is valid for one hour.\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
      html: `<!doctype html>
<html>
  <body style="font-family: 'Noto Sans SC', 'PingFang SC', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif; color: #1f1f1f;">
    <p>Hi there!</p>
    <p>We received a request to reset the password for your account.</p>
    <p>
      <a href="${resetUrl}" style="display: inline-block; padding: 12px 20px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px;">
        Reset password
      </a>
    </p>
    <p>If the button above doesn't work, copy and paste this URL into your browser:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
      This link is valid for one hour. If you didn't request this, you can safely ignore this email.
    </p>
  </body>
</html>`,
    });

    return { resetUrl, delivered: true };
  } catch (error) {
    console.error("[PasswordResetEmail] Failed to send email", error);
    return { resetUrl, delivered: false, reason: "send_failed" };
  }
}
