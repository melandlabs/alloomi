import { generateText } from "ai";
import { BENCHMARK_SCENARIOS } from "./scenarios";
import dotenv from "dotenv";
import path from "node:path";

const formatTime = (ms: number): string => {
  return ms < 1000 ? `${ms.toFixed(2)}ms` : `${(ms / 1000).toFixed(2)}s`;
};

// Load environment variables from .env.test BEFORE other imports
// This is crucial because lib/ai/providers.ts checks for env vars at the top level
dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

async function runBenchmark() {
  const totalStartTime = Date.now();

  // Dynamic imports to ensure environment variables are loaded before these modules are evaluated
  const { getModel } = await import("@/lib/ai");
  const { insightSystemPrompt } = await import("@/lib/ai/subagents/insights");

  console.log("🚀 Starting Live Benchmark...");
  console.log(`Found ${BENCHMARK_SCENARIOS.length} scenarios.`);
  console.log("==================================================\n");

  let passedCount = 0;
  let failedCount = 0;
  const scenarioDurations: number[] = [];

  for (const scenario of BENCHMARK_SCENARIOS) {
    const scenarioStartTime = Date.now();

    console.log("--------------------------------------------------");
    console.log(`Running Scenario: ${scenario.name}`);
    console.log(`Description: ${scenario.description}`);
    console.log("Status: Running...");

    const messagesText = JSON.stringify(scenario.messages, null, 2);
    const userPrompt = `My platform identity is ${JSON.stringify(scenario.userProfile)}, historical Insights: ${JSON.stringify(scenario.insights ?? [])}, please analyze the following incremental messages:\n${messagesText} and generate an Insight${scenario.extraInfo ? `\nAdditional information: ${scenario.extraInfo}` : ""}`;

    try {
      // 3. Call LLM
      console.log("⏳ Generating insight...");
      const { text } = await generateText({
        model: getModel(false),
        messages: [
          { role: "system", content: insightSystemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0, // Use 0 for deterministic results
      });

      // 4. Parse Output
      // Clean markdown code blocks if present
      const cleanText = text.replace(/```json\n|\n```/g, "").trim();
      let result: unknown;
      try {
        result = JSON.parse(cleanText);
      } catch (e) {
        console.error("Failed to parse JSON:", cleanText);
        throw e;
      }

      const insights =
        (result as any).insights ||
        (Array.isArray(result) ? (result as any[]) : []);

      const scenarioDuration = Date.now() - scenarioStartTime;
      scenarioDurations.push(scenarioDuration);
      console.log(`✅ Generation complete. [${formatTime(scenarioDuration)}]`);

      // 5. Validate
      const failures: string[] = [];

      // Validation: Urgency
      if (scenario.expected.urgency) {
        const hasMatchingUrgency = insights.some(
          (i: any) => i.urgency === scenario.expected.urgency,
        );
        if (!hasMatchingUrgency) {
          const actualUrgency =
            insights.length > 0 ? insights[0].urgency : "none";
          failures.push(
            `Expected urgency '${scenario.expected.urgency}', but got '${actualUrgency}'`,
          );
        }
      }

      // Validation: Importance
      if (scenario.expected.importance) {
        const hasMatchingImportance = insights.some(
          (i: any) => i.importance === scenario.expected.importance,
        );
        if (!hasMatchingImportance) {
          const actualImportance =
            insights.length > 0 ? insights[0].importance : "none";
          failures.push(
            `Expected importance '${scenario.expected.importance}', but got '${actualImportance}'`,
          );
        }
      }
      // Validation: Waiting For Others Count
      if (scenario.expected.waitingForOthersCount !== undefined) {
        let totalWaiting = 0;
        insights.forEach((i: any) => {
          if (i.waitingForOthers) totalWaiting += i.waitingForOthers.length;
        });
        if (totalWaiting !== scenario.expected.waitingForOthersCount) {
          failures.push(
            `Expected ${scenario.expected.waitingForOthersCount} waitingForOthers items, got ${totalWaiting}`,
          );
        }
      }

      // Validation: My Tasks Count
      if (scenario.expected.myTasksCount !== undefined) {
        let totalMyTasks = 0;
        insights.forEach((i: any) => {
          if (i.myTasks) totalMyTasks += i.myTasks.length;
        });
        if (totalMyTasks !== scenario.expected.myTasksCount) {
          failures.push(
            `Expected ${scenario.expected.myTasksCount} myTasks items, got ${totalMyTasks}`,
          );
        }
      }

      // Validation: Insight Count
      if (scenario.expected.insightCount !== undefined) {
        if (insights.length !== scenario.expected.insightCount) {
          failures.push(
            `Expected ${scenario.expected.insightCount} insights, got ${insights.length}`,
          );
        }
      }

      // Report
      if (failures.length === 0) {
        console.log("🟢 PASSED");
        passedCount++;
      } else {
        console.log("🔴 FAILED");
        failures.forEach((f) => console.error(`   - ${f}`));
        console.log(
          "   Actual Output Insight:",
          JSON.stringify(
            insights.map((i: any) => ({
              title: i.title,
              description: i.description,
              urgency: i.urgency,
              importance: i.importance,
              waitingForOthers: i.waitingForOthers,
              myTasks: i.myTasks,
            })),
            null,
            2,
          ),
        );
        failedCount++;
      }
    } catch (error) {
      const scenarioDuration = Date.now() - scenarioStartTime;
      scenarioDurations.push(scenarioDuration);
      console.log(
        `🔴 ERROR (Execution Failed) [${formatTime(scenarioDuration)}]`,
      );
      console.error(error);
      failedCount++;
    }
    console.log(`--------------------------------------------------\n`);
  }

  const totalDuration = Date.now() - totalStartTime;
  const averageDuration =
    scenarioDurations.length > 0
      ? scenarioDurations.reduce((sum, dur) => sum + dur, 0) /
        scenarioDurations.length
      : 0;

  console.log(`==================================================`);
  console.log(`Benchmark Summary:`);
  console.log(`- Total Scenarios: ${BENCHMARK_SCENARIOS.length}`);
  console.log(`- Passed: ${passedCount}`);
  console.log(`- Failed: ${failedCount}`);
  console.log(`- Total Runtime: ${formatTime(totalDuration)}`);
  console.log(`- Average Scenario Runtime: ${formatTime(averageDuration)}`);
  if (scenarioDurations.length > 0) {
    const fastest = Math.min(...scenarioDurations);
    const slowest = Math.max(...scenarioDurations);
    console.log(`- Fastest Scenario: ${formatTime(fastest)}`);
    console.log(`- Slowest Scenario: ${formatTime(slowest)}`);
  }
  console.log("==================================================");

  if (failedCount > 0) process.exit(1);
}

runBenchmark();
