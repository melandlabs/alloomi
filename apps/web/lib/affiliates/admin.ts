import type { Session } from "next-auth";

const rawAdminEmails =
  process.env.ADMIN_EMAILS ?? process.env.AFFILIATE_ADMIN_EMAILS ?? "";

const ADMIN_EMAILS = new Set(
  rawAdminEmails
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

export function isAffiliateAdmin(session: Session | null | undefined) {
  if (!session?.user?.email) return false;
  return ADMIN_EMAILS.has(session.user.email.toLowerCase());
}

export function isCouponAdmin(session: Session | null | undefined) {
  return isAffiliateAdmin(session);
}
