/**
 * Sandbox Provider Registry
 *
 * Manages sandbox provider registration, creation, and lifecycle.
 */

import type {
  ISandboxProvider,
  ProviderSelectionResult,
  SandboxInstance,
  SandboxPlugin,
  SandboxProviderConfig,
} from "./types";
import { PROVIDER_PRIORITY } from "./types";

/**
 * Global sandbox provider registry
 */
class SandboxRegistry {
  private static instance: SandboxRegistry;
  private plugins: Map<string, SandboxPlugin> = new Map();
  private instances: Map<string, SandboxInstance> = new Map();

  private constructor() {}

  static getInstance(): SandboxRegistry {
    if (!SandboxRegistry.instance) {
      SandboxRegistry.instance = new SandboxRegistry();
    }
    return SandboxRegistry.instance;
  }

  register(plugin: SandboxPlugin): void {
    const { type, name } = plugin.metadata;

    if (this.plugins.has(type)) {
      console.warn(
        `[SandboxRegistry] Provider "${type}" (${name}) is already registered. Overwriting...`,
      );
    }

    this.plugins.set(type, plugin);
    console.log(`[SandboxRegistry] Registered provider: ${type} (${name})`);
  }

  unregister(type: string): void {
    const plugin = this.plugins.get(type);
    if (plugin) {
      const instance = this.instances.get(type);
      if (instance) {
        instance.provider.stop().catch((err) => {
          console.error(
            `[SandboxRegistry] Error stopping provider ${type}:`,
            err,
          );
        });
        this.instances.delete(type);
      }

      this.plugins.delete(type);
      console.log(`[SandboxRegistry] Unregistered provider: ${type}`);
    }
  }

  create(config: SandboxProviderConfig): ISandboxProvider {
    const plugin = this.plugins.get(config.type);

    if (!plugin) {
      throw new Error(
        `Unknown sandbox provider type: "${config.type}". ` +
          `Available types: ${Array.from(this.plugins.keys()).join(", ")}`,
      );
    }

    const provider = plugin.factory(config.config);
    console.log(`[SandboxRegistry] Created provider instance: ${config.type}`);
    return provider;
  }

  async getInstance(
    type: string,
    config?: Record<string, unknown>,
  ): Promise<ISandboxProvider> {
    const existing = this.instances.get(type);
    if (existing && existing.state === "ready") {
      existing.lastUsedAt = new Date();
      return existing.provider;
    }

    const plugin = this.plugins.get(type);
    if (!plugin) {
      throw new Error(`Unknown sandbox provider type: "${type}"`);
    }

    const provider = plugin.factory(config);
    const instance: SandboxInstance = {
      provider,
      state: "uninitialized",
      config,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    this.instances.set(type, instance);

    try {
      instance.state = "initializing";
      await provider.init(config);
      instance.state = "ready";
      console.log(`[SandboxRegistry] Initialized provider: ${type}`);
    } catch (error) {
      instance.state = "error";
      instance.error =
        error instanceof Error ? error : new Error(String(error));
      console.error(
        `[SandboxRegistry] Failed to initialize provider ${type}:`,
        error,
      );
      throw error;
    }

    return provider;
  }

  has(type: string): boolean {
    return this.plugins.has(type);
  }

  getRegistered(): string[] {
    return Array.from(this.plugins.keys());
  }

  async getAvailable(): Promise<string[]> {
    const available: string[] = [];

    for (const [type, plugin] of this.plugins.entries()) {
      try {
        const provider = plugin.factory();
        const isAvailable = await provider.isAvailable();
        if (isAvailable) {
          available.push(type);
        }
        await provider.stop().catch(() => {});
      } catch (error) {
        console.warn(
          `[SandboxRegistry] Error checking availability for ${type}:`,
          error,
        );
      }
    }

    return available;
  }

  async getBestAvailable(): Promise<string | undefined> {
    const available = await this.getAvailable();

    if (available.length === 0) {
      return undefined;
    }

    const sorted = available.sort((a, b) => {
      const priorityA =
        PROVIDER_PRIORITY[a as keyof typeof PROVIDER_PRIORITY] || 0;
      const priorityB =
        PROVIDER_PRIORITY[b as keyof typeof PROVIDER_PRIORITY] || 0;
      return priorityB - priorityA;
    });

    return sorted[0];
  }

  getAllMetadata() {
    return Array.from(this.plugins.values()).map((plugin) => plugin.metadata);
  }

  async stopAll(): Promise<void> {
    const stopPromises: Promise<void>[] = [];

    for (const [type, instance] of this.instances.entries()) {
      console.log(`[SandboxRegistry] Stopping provider: ${type}`);
      stopPromises.push(
        instance.provider.stop().catch((err) => {
          console.error(`[SandboxRegistry] Error stopping ${type}:`, err);
        }),
      );
    }

    await Promise.all(stopPromises);
    this.instances.clear();
  }

  async getBestProviderWithInfo(): Promise<ProviderSelectionResult> {
    const bestType = await this.getBestAvailable();

    if (!bestType) {
      throw new Error(
        "No sandbox providers available. Please ensure at least one provider is installed.",
      );
    }

    const provider = await this.getInstance(bestType);
    const isUsingFallback = bestType !== "claude" && bestType !== "codex";

    return {
      provider,
      usedFallback: isUsingFallback,
      fallbackReason: isUsingFallback
        ? `${bestType} provider is being used (higher priority providers unavailable)`
        : undefined,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export function getSandboxRegistry(): SandboxRegistry {
  return SandboxRegistry.getInstance();
}

export function registerSandboxProvider(plugin: SandboxPlugin): void {
  const registry = getSandboxRegistry();
  registry.register(plugin);
}

export function createSandboxProvider(
  config: SandboxProviderConfig,
): ISandboxProvider {
  const registry = getSandboxRegistry();
  return registry.create(config);
}

export async function getSandboxProvider(
  type: string,
  config?: Record<string, unknown>,
): Promise<ISandboxProvider> {
  const registry = getSandboxRegistry();
  return registry.getInstance(type, config);
}

export async function getAvailableSandboxProviders(): Promise<string[]> {
  const registry = getSandboxRegistry();
  return registry.getAvailable();
}

export async function stopAllSandboxProviders(): Promise<void> {
  const registry = getSandboxRegistry();
  return registry.stopAll();
}
