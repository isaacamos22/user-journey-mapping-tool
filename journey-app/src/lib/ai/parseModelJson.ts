export function parseJsonFromModel(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1]?.trim() ?? content.trim();
  return JSON.parse(raw);
}