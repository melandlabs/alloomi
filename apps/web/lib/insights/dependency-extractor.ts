/**
 * Event dependency extractor
 * Uses LLM to analyze dependencies between Insights (prerequisites, references, etc.)
 *
 * Used for Day 2 enhancement of EventRank algorithm
 */

import { z } from "zod";

/**
 * Lazy import generateText, only load when needed
 */
async function getGenerateText() {
  const { generateText } = await import("ai");
  return generateText;
}

/**
 * Dependency types
 */
export enum DependencyType {
  PREREQUISITE = "prerequisite", // Prerequisite: A must be completed before B
  REFERENCE = "reference", // Reference: B can reference A's content
  BLOCKED_BY = "blocked_by", // Blocked: B is blocked by A
  RELATED = "related", // Related: A and B are related but not dependent
}

/**
 * Dependency weights (used for EventRank calculation)
 */
export const DEPENDENCY_WEIGHTS: Record<DependencyType, number> = {
  [DependencyType.PREREQUISITE]: 0.9, // Prerequisite: strong dependency
  [DependencyType.BLOCKED_BY]: 0.85, // Blocked: strong dependency
  [DependencyType.REFERENCE]: 0.3, // Reference: weak dependency
  [DependencyType.RELATED]: 0.2, // Related: weakest
};

/**
 * Extracted dependency
 */
export interface InsightDependency {
  fromId: string; // Source Insight ID
  toId: string; // Target Insight ID
  type: DependencyType;
  reason: string; // AI explanation for why this dependency exists
  confidence: number; // 0-1, confidence
}

/**
 * Schema for LLM output dependency
 */
const dependencyExtractionSchema = z.object({
  dependencies: z.array(
    z.object({
      fromIndex: z.number().describe("Source Insight index in input array"),
      toIndex: z.number().describe("Target Insight index in input array"),
      type: z.enum(["prerequisite", "reference", "blocked_by", "related"]),
      reason: z.string().describe("Explanation of why this dependency exists"),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

/**
 * System prompt for dependency extraction
 */
const DEPENDENCY_EXTRACTION_PROMPT = `## Role Definition

You are an expert task dependency analyzer. Your job is to analyze a list of events/insights and identify dependencies between them.

## Dependency Types

1. **prerequisite**: Event A must be completed before Event B can start
   - Example: "Design approval" must be done before "Implementation starts"
   - Weight: 0.9 (strong dependency)

2. **blocked_by**: Event B is blocked by Event A
   - Example: "Deployment" is blocked by "Bug fix"
   - Weight: 0.85 (strong dependency)

3. **reference**: Event B can reference information from Event A
   - Example: "Weekly report" can reference data from "Monday's meeting"
   - Weight: 0.3 (weak dependency)

4. **related**: Events A and B are related but neither depends on the other
   - Example: Two tasks in the same project
   - Weight: 0.2 (weakest dependency)

## Analysis Guidelines

1. **Extract Explicit Dependencies**: Look for:
   - Keywords: "after", "before", "once", "when", "depends on", "requires"
   - Temporal relationships: "first do X, then Y"
   - Blocking conditions: "waiting for", "blocked by", "holding on"

2. **Infer Implicit Dependencies**: Consider:
   - Logical workflow: Design → Develop → Test → Deploy
   - Data flow: Collect data → Analyze → Report
   - Approval chains: Draft → Review → Approve

3. **Avoid False Positives**: Do NOT mark as dependent if:
   - Events are just in the same project/channel but unrelated
   - Events share only keywords but no logical connection
   - Events are independent parallel tasks

4. **Confidence Scoring**:
   - 0.9-1.0: Explicit dependency stated in text
   - 0.7-0.9: Strong logical inference
   - 0.5-0.7: Moderate inference
   - 0.3-0.5: Weak inference
   - <0.3: Too uncertain, skip

5. **Output Format**:
   - Use 0-based indices for fromIndex and toIndex
   - Each dependency should only be listed once (no duplicates)
   - Do not create self-referential dependencies (fromIndex === toIndex)

## Examples

Input:
[
  {title: "Q3 Budget Approval", description: "Need CEO approval by Friday"},
  {title: "Submit Q3 Report", description: "Report depends on approved budget"},
  {title: "Team Meeting Notes", description: "Notes from Monday's all-hands"}
]

Output:
{
  "dependencies": [
    {
      "fromIndex": 0,
      "toIndex": 1,
      "type": "prerequisite",
      "reason": "Q3 Report submission explicitly depends on approved budget",
      "confidence": 0.95
    }
  ]
}

Now analyze the given events and output dependencies in JSON format.`;

/**
 * Convert dependencies to edge format required by EventRank
 */
export function dependenciesToEventEdges(
  dependencies: InsightDependency[],
): Array<{ fromId: string; toId: string; weight: number }> {
  return dependencies.map((dep) => ({
    fromId: dep.fromId,
    toId: dep.toId,
    weight: DEPENDENCY_WEIGHTS[dep.type] * dep.confidence,
  }));
}
