import { config } from "dotenv";
import { vi } from "vitest";

config({ path: ".env.test" });

// Mock server-only globally to prevent "Client Component" errors in tests
vi.mock("server-only", () => ({}));
