export type ParsedStory = { title: string; description: string };

function stripLead(s: string): string {
  return s.replace(/^\s*(#{1,6}|[-*]|\d+\.)\s*/, "").trim();
}

/** One work item from a whole message: first non-empty line is the title, the rest the body. */
export function splitMessage(msg: string): ParsedStory {
  const lines = msg.split(/\r?\n/);
  const firstIdx = lines.findIndex((l) => l.trim().length > 0);
  if (firstIdx < 0) return { title: "", description: "" };
  const title = stripLead(lines[firstIdx]).slice(0, 255);
  const description = lines.slice(firstIdx + 1).join("\n").trim();
  return { title, description };
}
