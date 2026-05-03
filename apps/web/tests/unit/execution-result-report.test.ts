import { describe, expect, it } from "vitest";
import {
  buildStructuredExecutionReport,
  normalizeReasoningSourceType,
  parseStructuredOutput,
} from "@/lib/types/execution-result";

describe("structured execution report", () => {
  it("builds stable reasoning steps when model structured output is missing", () => {
    const report = buildStructuredExecutionReport({
      structuredData: {},
      cleanText: "之前的搜索任务没有返回有用内容，但日报已生成。",
      rawText: "之前的搜索任务没有返回有用内容，但日报已生成。",
      taskText: "生成每日汇报",
      traceEvents: [
        { type: "tool_used", toolName: "webSearch", status: "running" },
        { type: "tool_result", status: "completed" },
      ],
    });

    expect(report.summary).toBe(
      "之前的搜索任务没有返回有用内容，但日报已生成。",
    );
    expect(report.reasoningChain?.length).toBeGreaterThanOrEqual(3);
    expect(
      report.reasoningChain?.some((step) => step.sourceType === "unknown"),
    ).toBe(false);
    expect(report.diagnostics?.warnings).toContain("model_reasoning_missing");
  });

  it("keeps model-provided English summaries intact", () => {
    const parsed = parseStructuredOutput(`<structured-output>
{
  "summary": "No platform data available because Telegram Slack and Gmail are not connected",
  "subtitle": "Telegram/Slack/Gmail not connected"
}
</structured-output>`);

    expect(parsed.data.summary).toBe(
      "No platform data available because Telegram Slack and Gmail are not connected",
    );
    expect(parsed.data.subtitle).toBe("Telegram/Slack/Gmail not connected");
  });

  it("localizes system-generated reasoning steps for English users", () => {
    const report = buildStructuredExecutionReport({
      structuredData: {},
      cleanText: "Collected 12 insights and extracted 11 action items.",
      rawText: "Collected 12 insights and extracted 11 action items.",
      taskText: "Collect today's information from Telegram Slack and Gmail",
      traceEvents: [
        { type: "tool_used", toolName: "chatInsight", status: "running" },
        { type: "tool_result", status: "completed" },
        { type: "tool_result", status: "error" },
      ],
      sessionFiles: [
        {
          name: "action-items.md",
          path: "/tmp/session/action-items.md",
          type: "md",
          role: "output",
        },
      ],
      language: "en-US",
    });

    expect(report.subtitle).toBe("Generated 1 file");
    expect(report.reasoningChain?.map((step) => step.summary)).toEqual(
      expect.arrayContaining([
        "Task received",
        "Collected information with tools",
        "Organized execution result",
        "Generated files",
        "Run completed",
      ]),
    );
    expect(report.reasoningChain?.map((step) => step.sourceLabel)).toEqual(
      expect.arrayContaining([
        "Task configuration",
        "Tool execution",
        "System summary",
        "Output files",
        "Execution result",
      ]),
    );
    expect(
      report.reasoningChain?.some((step) =>
        /[\u4e00-\u9fff]/u.test(
          `${step.summary} ${step.description ?? ""} ${step.sourceLabel ?? ""}`,
        ),
      ),
    ).toBe(false);
    expect(report.suggestedActions?.[0]).toMatchObject({
      type: "open_file",
      label: "Open action-items.md",
    });
  });

  it("normalizes unsupported source types instead of leaking unknown", () => {
    expect(normalizeReasoningSourceType("local_file")).toBe("file");
    expect(normalizeReasoningSourceType("browser")).toBe("web");
    expect(normalizeReasoningSourceType("task")).toBe("system");
  });

  it("normalizes model source type aliases during parsing", () => {
    const parsed = parseStructuredOutput(`<structured-output>
{
  "summary": "完成演示文稿",
  "reasoningChain": [
    { "summary": "读取 PPT", "sourceType": "pptx" }
  ]
}
</structured-output>`);

    expect(parsed.data.reasoningChain?.[0]?.sourceType).toBe("file");
  });

  it("adds generated files to reasoning and suggested actions", () => {
    const report = buildStructuredExecutionReport({
      structuredData: {
        summary: "完成演示文稿",
        reasoningChain: [
          {
            summary: "整理内容",
            sourceType: "pptx" as any,
          },
        ],
      },
      cleanText: "已生成文件。",
      rawText: "已生成文件。",
      taskText: "制作 PPT",
      sessionFiles: [
        {
          name: "Presentation.pptx",
          path: "/tmp/session/Presentation.pptx",
          type: "pptx",
          role: "output",
        },
      ],
    });

    expect(report.files).toHaveLength(1);
    expect(report.reasoningChain?.map((step) => step.stepType)).toContain(
      "generate",
    );
    expect(report.suggestedActions?.[0]).toMatchObject({
      type: "open_file",
      label: "Open Presentation.pptx",
    });
  });
});
