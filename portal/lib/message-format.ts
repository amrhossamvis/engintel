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

/**
 * Split a reply that contains several stories into one item each. A block of
 * two or more markdown headings is treated as a heading-per-story; anything
 * else is a single item. Conservative on purpose — numbered lines are usually
 * acceptance criteria, not separate stories.
 */
export function splitStories(msg: string): ParsedStory[] {
  const lines = msg.split(/\r?\n/);
  const headingIdx: number[] = [];
  lines.forEach((l, i) => {
    if (/^\s*#{1,6}\s+\S/.test(l)) headingIdx.push(i);
  });

  if (headingIdx.length < 2) return [splitMessage(msg)];

  const stories: ParsedStory[] = [];
  for (let h = 0; h < headingIdx.length; h++) {
    const start = headingIdx[h];
    const end = h + 1 < headingIdx.length ? headingIdx[h + 1] : lines.length;
    const title = stripLead(lines[start]).slice(0, 255);
    const description = lines.slice(start + 1, end).join("\n").trim();
    if (title) stories.push({ title, description });
  }
  return stories.length ? stories : [splitMessage(msg)];
}
