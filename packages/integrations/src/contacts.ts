/**
 * Contact metadata types for platform integrations
 */

export type TelegramContactMeta = {
  platform: "telegram";
  peerId: string;
  peerType: "user" | "chat" | "channel";
  accessHash?: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null; // Full display name (firstName + lastName)
};

type NonTelegramContactMeta = {
  platform?: Exclude<string, "telegram">;
  [key: string]: unknown;
};

export type ContactMeta = TelegramContactMeta | NonTelegramContactMeta;

export function isTelegramContactMeta(
  meta: ContactMeta | null | undefined,
): meta is TelegramContactMeta {
  return (
    Boolean(meta) &&
    (meta as TelegramContactMeta).platform === "telegram" &&
    typeof (meta as TelegramContactMeta).peerId === "string" &&
    typeof (meta as TelegramContactMeta).peerType === "string"
  );
}
