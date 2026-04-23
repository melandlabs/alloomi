import { describe, expect, it } from "vitest";
import {
  containsMalformedToolCall,
  extractMalformedToolCalls,
  stripMalformedToolCalls,
} from "@/lib/utils/tool-names";

describe("stripMalformedToolCalls", () => {
  describe("containsMalformedToolCall", () => {
    it("should detect malformed tool call with double quotes", () => {
      const input =
        '<invoke name="mcp_business-tools modifyInsight">content</invoke>';
      expect(containsMalformedToolCall(input)).toBe(true);
    });

    it("should detect malformed tool call with single quotes", () => {
      const input = "<invoke name='test'>content</invoke>";
      expect(containsMalformedToolCall(input)).toBe(true);
    });

    it("should detect malformed tool call with unquoted name", () => {
      const input = "<invoke name=test>content</invoke>";
      expect(containsMalformedToolCall(input)).toBe(true);
    });

    it("should detect malformed tool call with spaces in name", () => {
      const input =
        '<invoke name="mcp_business-tools modifyInsight">content</invoke>';
      expect(containsMalformedToolCall(input)).toBe(true);
    });

    it("should not detect normal text without tool calls", () => {
      const input = "This is a normal message";
      expect(containsMalformedToolCall(input)).toBe(false);
    });

    it("should not detect partial opening tags without closing", () => {
      const input = "I used the <invoke>tag</invoke> in my message";
      expect(containsMalformedToolCall(input)).toBe(false);
    });

    it("should handle empty string", () => {
      expect(containsMalformedToolCall("")).toBe(false);
    });

    it("should handle null/undefined", () => {
      expect(containsMalformedToolCall(null as any)).toBe(false);
      expect(containsMalformedToolCall(undefined as any)).toBe(false);
    });
  });

  describe("extractMalformedToolCalls", () => {
    it("should extract tool call with double quotes", () => {
      const input = '<invoke name="test">content</invoke>';
      const result = extractMalformedToolCalls(input);
      expect(result).toHaveLength(1);
      expect(result[0].fullMatch).toBe(input);
    });

    it("should extract multiple tool calls", () => {
      const input =
        'First <invoke name="tool1">...</invoke> then <invoke name="tool2">...</invoke> text';
      const result = extractMalformedToolCalls(input);
      expect(result).toHaveLength(2);
    });

    it("should return empty array for normal text", () => {
      const input = "No tool calls here";
      expect(extractMalformedToolCalls(input)).toEqual([]);
    });
  });

  describe("stripMalformedToolCalls", () => {
    it("should strip complete malformed tool call", () => {
      const input =
        '<invoke name="mcp_business-tools modifyInsight">content</invoke>';
      expect(stripMalformedToolCalls(input)).toBe("");
    });

    it("should strip tool call with complex content", () => {
      const input = `<invoke name="mcp_business-tools modifyInsight"> <parametername="insightId">test</parametername></invoke>`;
      expect(stripMalformedToolCalls(input)).toBe("");
    });

    it("should preserve text before tool call", () => {
      const input = 'Hello <invoke name="test">...</invoke> World';
      expect(stripMalformedToolCalls(input)).toBe("Hello  World");
    });

    it("should preserve text after tool call", () => {
      const input = '<invoke name="test">...</invoke> How are you?';
      expect(stripMalformedToolCalls(input)).toBe("How are you?");
    });

    it("should handle chat output prefix", () => {
      const input =
        'chat output: \n<invoke name="mcp_business-tools modifyInsight">...</invoke>\n\nsome real text';
      expect(stripMalformedToolCalls(input)).toBe("some real text");
    });

    it("should strip multiple tool calls", () => {
      const input =
        '<invoke name="tool1">a</invoke> text <invoke name="tool2">b</invoke>';
      expect(stripMalformedToolCalls(input)).toBe("text");
    });

    it("should not modify normal text", () => {
      const input = "This is a normal message without any tool calls";
      expect(stripMalformedToolCalls(input)).toBe(input);
    });

    it("should clean up excessive whitespace", () => {
      const input = '<invoke name="test">...</invoke>\n\n\n\nHello';
      expect(stripMalformedToolCalls(input)).toBe("Hello");
    });

    it("should handle real MiniMax malformed output from issue", () => {
      const input = `chat output:
<invoke name="mcp_business-tools modifyInsight"> <parametername="insightId">0cblc9de-ece5-463d-8255-cel9ac6d19c</parametername="updates">{"timeline": [{"time": 17762636000000,"summary":"Candidate report updated"}]}</invoke>

some real response text`;
      const result = stripMalformedToolCalls(input);
      expect(result).toBe("some real response text");
    });

    it("should handle single quoted tool call", () => {
      const input = "<invoke name='test'>content</invoke>";
      expect(stripMalformedToolCalls(input)).toBe("");
    });

    it("should handle unquoted tool call", () => {
      const input = "<invoke name=test>content</invoke>";
      expect(stripMalformedToolCalls(input)).toBe("");
    });
  });
});
