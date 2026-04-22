/**
 * Sandbox Provider Types
 *
 * Defines the interfaces for extensible sandbox providers.
 * Supports: Codex (Process), Claude (Container), Native (Process), Docker, E2B, Vercel
 */

// ============================================================================
// Provider Types
// ============================================================================

/**
 * Built-in sandbox provider types
 */
export type BuiltinSandboxProviderType =
  | "docker"
  | "native"
  | "e2b"
  | "codex"
  | "claude"
  | "vercel";

/**
 * Sandbox provider type - string to allow custom extensions
 */
export type SandboxProviderType = BuiltinSandboxProviderType | (string & {});

export interface SandboxCapabilities {
  /** Whether volume mounts from host are supported */
  supportsVolumeMounts: boolean;
  /** Whether network access is available */
  supportsNetworking: boolean;
  /** Level of isolation provided */
  isolation: "vm" | "container" | "process" | "none";
  /** Supported runtime environments */
  supportedRuntimes: string[];
  /** Whether the provider supports multiple concurrent instances */
  supportsPooling: boolean;
}

// ============================================================================
// Execution Options and Results
// ============================================================================

export interface SandboxExecOptions {
  /** Command to execute */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Working directory inside sandbox */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Container/VM image to use (provider-specific) */
  image?: string;
  /** User ID for per-user sandbox instances (provider-specific) */
  userId?: string;
}

export interface SandboxExecResult {
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Exit code */
  exitCode: number;
  /** Execution duration in milliseconds */
  duration: number;
  /** Provider that executed the command (for UI display) */
  provider?: {
    type: SandboxProviderType;
    name: string;
    isolation: "vm" | "container" | "process" | "none";
  };
}

export interface ScriptOptions {
  /** Script arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Additional packages to install before running */
  packages?: string[];
  /** User ID for per-user sandbox instances (provider-specific) */
  userId?: string;
}

// ============================================================================
// Volume Mounts
// ============================================================================

export interface VolumeMount {
  /** Path on the host system */
  hostPath: string;
  /** Path inside the sandbox */
  guestPath: string;
  /** Whether the mount is read-only */
  readOnly?: boolean;
}

// ============================================================================
// Provider Configuration
// ============================================================================

export interface SandboxProviderConfig {
  /** Provider type identifier */
  type: SandboxProviderType;
  /** Human-readable name */
  name: string;
  /** Whether this provider is enabled */
  enabled: boolean;
  /** Provider-specific configuration */
  config: Record<string, unknown>;
}

export interface DockerProviderConfig extends SandboxProviderConfig {
  type: "docker";
  config: {
    socketPath?: string;
    defaultImage?: string;
    memoryLimit?: string;
    cpuLimit?: string;
  };
}

export interface NativeProviderConfig extends SandboxProviderConfig {
  type: "native";
  config: {
    allowedDirectories?: string[];
    shell?: string;
    defaultTimeout?: number;
  };
}

export interface E2BProviderConfig extends SandboxProviderConfig {
  type: "e2b";
  config: {
    apiKey?: string;
    templateId?: string;
    timeout?: number;
  };
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Base interface for all sandbox providers.
 */
export interface ISandboxProvider {
  readonly type: SandboxProviderType;
  readonly name: string;

  isAvailable(): Promise<boolean>;
  init(config?: Record<string, unknown>): Promise<void>;
  exec(options: SandboxExecOptions): Promise<SandboxExecResult>;
  runScript(
    filePath: string,
    workDir: string,
    options?: ScriptOptions,
  ): Promise<SandboxExecResult>;
  stop(): Promise<void>;
  shutdown(): Promise<void>;
  getCapabilities(): SandboxCapabilities;
  setVolumes?(volumes: VolumeMount[]): void;
}

// ============================================================================
// Factory Types
// ============================================================================

export type SandboxProviderFactory = (
  config?: SandboxProviderConfig,
) => ISandboxProvider;

export interface SandboxProviderRegistry {
  register(type: SandboxProviderType, factory: SandboxProviderFactory): void;
  get(type: SandboxProviderType): SandboxProviderFactory | undefined;
  create(config: SandboxProviderConfig): ISandboxProvider;
  getAvailable(): Promise<SandboxProviderType[]>;
}

// ============================================================================
// Default Images
// ============================================================================

export const SANDBOX_IMAGES = {
  node: "node:18-alpine",
  python: "python:3.11-slim",
  bun: "oven/bun:latest",
} as const;

export type SandboxImage = keyof typeof SANDBOX_IMAGES;

// ============================================================================
// Agent-level SandboxConfig (re-exported here for convenience)
// ============================================================================

export interface SandboxConfig {
  /** Whether sandbox mode is enabled */
  enabled: boolean;
  /** Sandbox provider to use */
  provider?: SandboxProviderType;
  /** Container image to use */
  image?: string;
  /** API endpoint for sandbox service (deprecated, use provider instead) */
  apiEndpoint?: string;
  /** Provider-specific configuration */
  providerConfig?: Record<string, unknown>;
}

// ============================================================================
// Plugin System Types (sandbox-specific)
// ============================================================================

/**
 * Provider metadata for sandbox plugin registration
 */
export interface SandboxProviderMetadata {
  type: string;
  name: string;
  description?: string;
  version?: string;
  capabilities?: SandboxCapabilities;
  configSchema?: Record<string, unknown>;
  priority?: number;
  builtin?: boolean;
}

/**
 * Sandbox plugin definition
 */
export interface SandboxPlugin {
  metadata: SandboxProviderMetadata;
  factory: (config?: Record<string, unknown>) => ISandboxProvider;
  onInit?: () => Promise<void>;
  onDestroy?: () => Promise<void>;
}

/**
 * Provider instance with state tracking
 */
export interface SandboxInstance {
  provider: ISandboxProvider;
  state: "uninitialized" | "initializing" | "ready" | "error" | "stopped";
  config?: Record<string, unknown>;
  error?: Error;
  createdAt?: Date;
  lastUsedAt?: Date;
}

/**
 * Provider selection result with fallback info
 */
export interface ProviderSelectionResult {
  provider: ISandboxProvider;
  usedFallback: boolean;
  fallbackReason?: string;
}

// ============================================================================
// Provider Priority Order
// ============================================================================

export const PROVIDER_PRIORITY: Record<string, number> = {
  vercel: 150,
  claude: 100,
  codex: 90,
  native: 10,
};

export const PROVIDER_FALLBACK_ORDER: string[] = [
  "vercel",
  "claude",
  "codex",
  "native",
];
