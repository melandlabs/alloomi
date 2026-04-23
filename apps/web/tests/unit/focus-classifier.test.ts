import { describe, it, expect } from "vitest";
import {
  extractInsightTags,
  classifyFocusInsight,
  getFocusCategoryMeta,
} from "@/lib/insights/focus-classifier";

describe("extractInsightTags", () => {
  it("should extract 'important' tag when importance is 'Important'", () => {
    const tags = extractInsightTags({ importance: "Important" });
    expect(tags).toContain("important");
  });

  it("should extract 'important' tag when importance is 'Important'", () => {
    const tags = extractInsightTags({ importance: "Important" });
    expect(tags).toContain("important");
  });

  it("should extract 'urgent' tag when urgency is 'Handle ASAP'", () => {
    const tags = extractInsightTags({ urgency: "ASAP" });
    expect(tags).toContain("urgent");
  });

  it("should extract 'urgent' tag when urgency is 'Urgent'", () => {
    const tags = extractInsightTags({ urgency: "Urgent" });
    expect(tags).toContain("urgent");
  });

  it("should extract 'mentions-me' tag when hasMyNickname is true", () => {
    const tags = extractInsightTags({ hasMyNickname: true });
    expect(tags).toContain("mentions-me");
  });

  it("should extract 'action-items' tag when hasActions is true", () => {
    const tags = extractInsightTags({ hasActions: true });
    expect(tags).toContain("action-items");
  });

  it("should extract multiple tags", () => {
    const tags = extractInsightTags({
      importance: "Important",
      urgency: "ASAP",
      hasMyNickname: true,
      hasActions: true,
    });
    expect(tags).toHaveLength(4);
    expect(tags).toContain("important");
    expect(tags).toContain("urgent");
    expect(tags).toContain("mentions-me");
    expect(tags).toContain("action-items");
  });

  it("should return empty array when no tags match", () => {
    const tags = extractInsightTags({});
    expect(tags).toHaveLength(0);
  });

  it("should extract 'action-items' tag when isUnreplied is true", () => {
    const tags = extractInsightTags({ isUnreplied: true });
    expect(tags).toContain("action-items");
  });

  it("should extract 'action-items' tag when both hasActions and isUnreplied are true", () => {
    const tags = extractInsightTags({ hasActions: true, isUnreplied: true });
    expect(tags).toContain("action-items");
    // Should only have one "action-items" tag, not duplicated
    expect(tags.filter((t) => t === "action-items")).toHaveLength(1);
  });

  it("should extract 'action-items' tag when only hasActions is true", () => {
    const tags = extractInsightTags({ hasActions: true, isUnreplied: false });
    expect(tags).toContain("action-items");
  });

  it("should extract 'action-items' tag when only isUnreplied is true", () => {
    const tags = extractInsightTags({ hasActions: false, isUnreplied: true });
    expect(tags).toContain("action-items");
  });
});

describe("classifyFocusInsight - Optimized Rules", () => {
  describe("Rule 1: Immediate Action (Urgent)", () => {
    it("should classify as 'immediate' when only 'Urgent' tag is present", () => {
      const insight = { urgency: "Urgent" };
      expect(classifyFocusInsight(insight)).toBe("immediate");
    });

    it("should classify as 'immediate' when 'Urgent' + 'action-items'", () => {
      const insight = { urgency: "Urgent", hasActions: true };
      expect(classifyFocusInsight(insight)).toBe("immediate");
    });

    it("should classify as 'immediate' when 'Urgent' + 'Important'", () => {
      const insight = { urgency: "Urgent", importance: "Important" };
      expect(classifyFocusInsight(insight)).toBe("immediate");
    });

    it("should classify as 'immediate' when 'Urgent' + 'Mentions Me'", () => {
      const insight = { urgency: "Urgent", hasMyNickname: true };
      expect(classifyFocusInsight(insight)).toBe("immediate");
    });

    it("should classify as 'immediate' when all tags are present", () => {
      const insight = {
        urgency: "Urgent",
        importance: "Important",
        hasActions: true,
        hasMyNickname: true,
      };
      expect(classifyFocusInsight(insight)).toBe("immediate");
    });
  });

  describe("Rule 2: Important Todo (has myTasks and not urgent)", () => {
    it("should classify as 'high-priority' when myTasks is present (no Urgent)", () => {
      const insight = {
        myTasks: [{ id: 1 }],
      };
      expect(classifyFocusInsight(insight)).toBe("high-priority");
    });

    it("should classify as 'high-priority' when myTasks + 'Important' (no Urgent)", () => {
      const insight = {
        myTasks: [{ id: 1 }],
        importance: "Important",
      };
      expect(classifyFocusInsight(insight)).toBe("high-priority");
    });

    it("should classify as 'high-priority' when myTasks + 'Mentions Me' (no Urgent)", () => {
      const insight = {
        myTasks: [{ id: 1 }],
        hasMyNickname: true,
      };
      expect(classifyFocusInsight(insight)).toBe("high-priority");
    });

    it("should classify as 'immediate' when myTasks + 'Urgent' (Urgent has priority)", () => {
      const insight = {
        myTasks: [{ id: 1 }],
        urgency: "Urgent",
      };
      expect(classifyFocusInsight(insight)).toBe("immediate");
    });
  });

  describe("Rule 3: Attention Info (Important and no myTasks and not urgent)", () => {
    it("should classify as 'important-info' when only 'Important' tag is present", () => {
      const insight = { importance: "Important" };
      expect(classifyFocusInsight(insight)).toBe("important-info");
    });

    it("should classify as 'important-info' when 'Important' + 'Mentions Me' (no myTasks, no Urgent)", () => {
      const insight = { importance: "Important", hasMyNickname: true };
      expect(classifyFocusInsight(insight)).toBe("important-info");
    });

    it("should classify as 'high-priority' when 'Important' + myTasks (Tasks have priority)", () => {
      const insight = {
        importance: "Important",
        myTasks: [{ id: 1 }],
      };
      expect(classifyFocusInsight(insight)).toBe("high-priority");
    });

    it("should classify as 'immediate' when 'Important' + 'Urgent' (Urgent has priority)", () => {
      const insight = { importance: "Important", urgency: "Urgent" };
      expect(classifyFocusInsight(insight)).toBe("immediate");
    });
  });

  describe("Rule 4: Follow Up (Mentions Me)", () => {
    it("should classify as 'follow-up' when only 'Mentions Me' tag is present", () => {
      const insight = { hasMyNickname: true };
      expect(classifyFocusInsight(insight)).toBe("follow-up");
    });

    it("should classify as 'immediate' when 'Mentions Me' + 'Urgent' (Urgent has priority)", () => {
      const insight = { hasMyNickname: true, urgency: "Urgent" };
      expect(classifyFocusInsight(insight)).toBe("immediate");
    });

    it("should classify as 'high-priority' when 'Mentions Me' + myTasks (Tasks have priority)", () => {
      const insight = {
        hasMyNickname: true,
        myTasks: [{ id: 1 }],
      };
      expect(classifyFocusInsight(insight)).toBe("high-priority");
    });

    it("should classify as 'important-info' when 'Mentions Me' + 'Important' (Important has priority)", () => {
      const insight = {
        hasMyNickname: true,
        importance: "Important",
      };
      expect(classifyFocusInsight(insight)).toBe("important-info");
    });
  });

  describe("Rule 5: No Display (empty tags)", () => {
    it("should return null when insight has no tags", () => {
      const insight = {};
      expect(classifyFocusInsight(insight)).toBeNull();
    });
  });

  describe("Priority Order Verification", () => {
    it("should prioritize 'Urgent' over 'myTasks'", () => {
      const insight = {
        urgency: "Urgent",
        myTasks: [{ id: 1 }],
      };
      expect(classifyFocusInsight(insight)).toBe("immediate");
    });

    it("should prioritize 'Urgent' over 'Important'", () => {
      const insight = {
        urgency: "Urgent",
        importance: "Important",
      };
      expect(classifyFocusInsight(insight)).toBe("immediate");
    });

    it("should prioritize 'myTasks' over 'Important'", () => {
      const insight = {
        myTasks: [{ id: 1 }],
        importance: "Important",
      };
      expect(classifyFocusInsight(insight)).toBe("high-priority");
    });

    it("should prioritize 'myTasks' over 'Mentions Me'", () => {
      const insight = {
        myTasks: [{ id: 1 }],
        hasMyNickname: true,
      };
      expect(classifyFocusInsight(insight)).toBe("high-priority");
    });

    it("should prioritize 'Important' over 'Mentions Me'", () => {
      const insight = {
        importance: "Important",
        hasMyNickname: true,
      };
      expect(classifyFocusInsight(insight)).toBe("important-info");
    });
  });
});

describe("getFocusCategoryMeta", () => {
  it("should return correct metadata for 'immediate'", () => {
    const meta = getFocusCategoryMeta("immediate");
    expect(meta).toEqual({
      category: "immediate",
      icon: "🚨",
      labelKey: "insight.focus.immediate",
    });
  });

  it("should return correct metadata for 'high-priority'", () => {
    const meta = getFocusCategoryMeta("high-priority");
    expect(meta).toEqual({
      category: "high-priority",
      icon: "⚡",
      labelKey: "insight.focus.highPriority",
    });
  });

  it("should return correct metadata for 'important-info'", () => {
    const meta = getFocusCategoryMeta("important-info");
    expect(meta).toEqual({
      category: "important-info",
      icon: "💡",
      labelKey: "insight.focus.importantInfo",
    });
  });

  it("should return correct metadata for 'follow-up'", () => {
    const meta = getFocusCategoryMeta("follow-up");
    expect(meta).toEqual({
      category: "follow-up",
      icon: "👀",
      labelKey: "insight.focus.followUp",
    });
  });

  it("should return null for null category", () => {
    const meta = getFocusCategoryMeta(null);
    expect(meta).toBeNull();
  });
});
