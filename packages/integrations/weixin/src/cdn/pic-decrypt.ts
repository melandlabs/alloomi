import { decryptAesEcb } from "./aes-ecb";
import { buildCdnDownloadUrl } from "./cdn-url";
import { logger } from "../shims/logger";

async function fetchCdnBytes(url: string, label: string): Promise<Buffer> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    const cause =
      (err as NodeJS.ErrnoException).cause ??
      (err as NodeJS.ErrnoException).code ??
      "(no cause)";
    logger.error(
      `${label}: fetch network error url=${url} err=${String(err)} cause=${String(cause)}`,
    );
    throw err;
  }
  logger.debug(`${label}: response status=${res.status} ok=${res.ok}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    const msg = `${label}: CDN download ${res.status} ${res.statusText} body=${body}`;
    logger.error(msg);
    throw new Error(msg);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Parse aes_key returned by CDN. */
function parseAesKey(aesKeyBase64: string, label: string): Buffer {
  const decoded = Buffer.from(aesKeyBase64, "base64");
  if (decoded.length === 16) return decoded;
  if (
    decoded.length === 32 &&
    /^[0-9a-fA-F]{32}$/.test(decoded.toString("ascii"))
  ) {
    return Buffer.from(decoded.toString("ascii"), "hex");
  }
  const msg = `${label}: aes_key format invalid, decoded length=${decoded.length}`;
  logger.error(msg);
  throw new Error(msg);
}

/** Download and decrypt CDN media, return plaintext Buffer. */
export async function downloadAndDecryptBuffer(
  encryptedQueryParam: string,
  aesKeyBase64: string,
  cdnBaseUrl: string,
  label: string,
): Promise<Buffer> {
  const key = parseAesKey(aesKeyBase64, label);
  const url = buildCdnDownloadUrl(encryptedQueryParam, cdnBaseUrl);
  logger.debug(`${label}: fetching url=${url}`);
  const encrypted = await fetchCdnBytes(url, label);
  logger.debug(
    `${label}: downloaded ${encrypted.byteLength} bytes, decrypting`,
  );
  const decrypted = decryptAesEcb(encrypted, key);
  logger.debug(`${label}: decrypted ${decrypted.length} bytes`);
  return decrypted;
}
