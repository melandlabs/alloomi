/**
 * Native Skills API Routes
 *
 * Manage and list available skills
 */

import { NextResponse } from "next/server";
import { loadSkills } from "@/lib/ai/skills/loader";

// GET /api/native/skills - List all available skills
export async function GET() {
  try {
    const skills = loadSkills();

    return NextResponse.json({
      skills,
      count: skills.length,
    });
  } catch (error) {
    console.error("[SkillsAPI] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list skills",
      },
      { status: 500 },
    );
  }
}
