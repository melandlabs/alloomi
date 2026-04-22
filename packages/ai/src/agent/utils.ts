export function extractJsonFromMarkdown(text: string): string | null {
  let result = text;

  // Remove markdown code blocks
  result = result.replace(/^```json\s*/, "");
  result = result.replace(/\s*```$/, "");

  // Try to extract JSON object from text (in case AI added text before/after)
  const jsonMatch = result.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    result = jsonMatch[0];
  }

  return result.trim() || null;
}
