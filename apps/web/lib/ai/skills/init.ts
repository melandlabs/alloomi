// Initialize skills bundler (only in Tauri environment)
export async function initializeSkillsBundler() {
  if (process.env.TAURI_MODE === "1" || process.env.IS_TAURI === "true") {
    try {
      const { ensureSkillsInitialized } = await import("./bundler-stub");
      await ensureSkillsInitialized();
    } catch (error) {
      console.error("[Page] Failed to initialize skills bundler:", error);
    }
  }
}
