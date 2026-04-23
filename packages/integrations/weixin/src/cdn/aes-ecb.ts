import { createCipheriv, createDecipheriv } from "node:crypto";

/** Encrypt plaintext using AES-128-ECB (default PKCS7 padding). */
export function encryptAesEcb(plaintext: Buffer, key: Buffer): Buffer {
  const cipher = createCipheriv("aes-128-ecb", key, null);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}

/** Decrypt ciphertext using AES-128-ECB (PKCS7 padding). */
export function decryptAesEcb(ciphertext: Buffer, key: Buffer): Buffer {
  const decipher = createDecipheriv("aes-128-ecb", key, null);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Calculate AES-128-ECB encrypted length (16-byte aligned + PKCS7). */
export function aesEcbPaddedSize(plaintextSize: number): number {
  return Math.ceil((plaintextSize + 1) / 16) * 16;
}
