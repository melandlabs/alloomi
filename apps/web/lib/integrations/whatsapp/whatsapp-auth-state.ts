/**
 * WhatsApp Baileys Auth State
 *
 * Supports two backends:
 *   - Tauri / local dev → useMultiFileAuthState (file-based, synchronous)
 *   - Production        → Redis keys + Baileys initAuthCreds
 */

import path from "node:path";
import type {
  AuthenticationState,
  AuthenticationCreds,
  SignalKeyStore,
  SignalDataTypeMap,
  SignalDataSet,
} from "@whiskeysockets/baileys/lib/Types/Auth";
import { initAuthCreds } from "@whiskeysockets/baileys/lib/Utils/auth-utils";
import { useMultiFileAuthState } from "@whiskeysockets/baileys/lib/Utils/use-multi-file-auth-state";
import redis from "@/lib/session/context";
import { isTauriMode } from "@/lib/env";
import { getTauriDataDir } from "@/lib/utils/path";

const TTL_SECONDS = 86400 * 356;

function getDataPath(): string {
  if (process.env.WHATSAPP_AUTH_DATA_PATH)
    return process.env.WHATSAPP_AUTH_DATA_PATH;
  if (isTauriMode()) return path.join(getTauriDataDir(), "whatsapp");
  return path.resolve(".wa_auth");
}

// ----- Redis-backed SignalKeyStore -----

class RedisKeys implements SignalKeyStore {
  constructor(private sessionId: string) {}

  private key(type: string, id: string) {
    return `wa_baileys:${this.sessionId}:keys:${type}:${id}`;
  }

  async get<T extends keyof SignalDataTypeMap>(
    type: T,
    ids: string[],
  ): Promise<{ [id: string]: SignalDataTypeMap[T] }> {
    if (!redis) {
      const r: { [id: string]: SignalDataTypeMap[T] } = {};
      for (const id of ids) r[id] = null as unknown as SignalDataTypeMap[T];
      return r;
    }
    const pipeline = redis.pipeline();
    for (const id of ids) pipeline.getBuffer(this.key(type, id));
    const results = await pipeline.exec();
    const result: { [id: string]: SignalDataTypeMap[T] } = {};
    for (let i = 0; i < ids.length; i++) {
      const raw = results?.[i]?.[1];
      if (raw !== null && raw !== undefined) {
        try {
          result[ids[i]] = JSON.parse(
            Buffer.isBuffer(raw) ? raw.toString("utf-8") : String(raw),
          ) as SignalDataTypeMap[T];
        } catch {
          /* invalid */
        }
      }
    }
    return result;
  }

  async set(data: SignalDataSet): Promise<void> {
    if (!redis) return;
    const pipeline = redis.pipeline();
    for (const [type, entries] of Object.entries(data)) {
      if (!entries) continue;
      for (const [id, value] of Object.entries(entries)) {
        pipeline.set(
          this.key(type, id),
          JSON.stringify(value),
          "EX",
          TTL_SECONDS,
        );
      }
    }
    await pipeline.exec();
  }

  async clear(): Promise<void> {
    if (!redis) return;
    const keys = await redis.keys(`wa_baileys:${this.sessionId}:*`);
    if (keys.length > 0) await redis.del(...keys);
  }
}

// ----- Main class -----

export class WhatsAppBaileysAuthState {
  // Initialized lazily by ensureAuthState()
  private _state: AuthenticationState | null = null;
  private _initPromise: Promise<void> | null = null;

  constructor(private sessionId: string) {}

  /**
   * Load (or create) auth state. Safe to call multiple times — only initializes once.
   */
  async ensureAuthState(): Promise<AuthenticationState> {
    if (this._state) return this._state;
    if (this._initPromise) {
      await this._initPromise;
      const state = this._state;
      if (!state) throw new Error("Auth state not initialized");
      return state;
    }
    this._initPromise = this._doInit();
    await this._initPromise;
    const state = this._state;
    if (!state) throw new Error("Auth state not initialized");
    return state;
  }

  private async _doInit(): Promise<void> {
    const dataPath = getDataPath();

    if (isTauriMode()) {
      // File-based: use Baileys's own impl (synchronous reads via async-lock)
      const { state, saveCreds } = await useMultiFileAuthState(
        path.join(dataPath, this.sessionId),
      );
      this._state = state;
      // Also expose saveCreds on state so Baileys can call it
      (
        this._state as typeof state & { saveCreds: typeof saveCreds }
      ).saveCreds = saveCreds;
      return;
    }

    // Redis-backed
    let creds: AuthenticationCreds;
    if (!redis) {
      creds = initAuthCreds();
    } else {
      const raw = await redis.get(`wa_baileys:${this.sessionId}:creds`);
      if (raw) {
        try {
          creds = JSON.parse(raw) as AuthenticationCreds;
        } catch {
          creds = initAuthCreds();
        }
      } else {
        creds = initAuthCreds();
      }
    }

    const keys = new RedisKeys(this.sessionId);
    this._state = { creds, keys };
  }

  async exists(): Promise<boolean> {
    if (isTauriMode()) {
      const dataPath = getDataPath();
      const { existsSync } = await import("node:fs");
      const fullPath = path.join(dataPath, this.sessionId, "creds.json");
      const result = existsSync(fullPath);
      return result;
    }
    if (!redis) return false;
    const raw = await redis.get(`wa_baileys:${this.sessionId}:creds`);
    return raw !== null;
  }

  async clear(): Promise<void> {
    if (isTauriMode()) {
      const { rm } = await import("node:fs/promises");
      const dataPath = getDataPath();
      await rm(path.join(dataPath, this.sessionId), {
        recursive: true,
        force: true,
      });
    } else {
      if (redis) {
        const keys = await redis.keys(`wa_baileys:${this.sessionId}:*`);
        if (keys.length > 0) await redis.del(...keys);
      }
    }
    this._state = null;
  }

  /**
   * Save current creds to file/Redis.
   * Calls the wrapped saveCreds from useMultiFileAuthState (Tauri)
   * or persists directly (cloud).
   */
  async saveCreds(): Promise<void> {
    if (!this._state) return;
    if (isTauriMode()) {
      // saveCreds is attached on the state in _doInit
      const fn = (
        this._state as AuthenticationState & { saveCreds?: () => Promise<void> }
      ).saveCreds;
      if (fn) await fn();
    } else if (redis) {
      await redis.set(
        `wa_baileys:${this.sessionId}:creds`,
        JSON.stringify(this._state.creds),
        "EX",
        TTL_SECONDS,
      );
    }
  }
}

export function createWhatsAppAuthState(sessionId: string) {
  return new WhatsAppBaileysAuthState(sessionId);
}
