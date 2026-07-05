import { exec } from 'child_process';

const DEFAULT_COMMAND = process.env.COPILOT_CLI_COMMAND || 'copilot --silent --no-ask-user --stream off --no-color';
const DEFAULT_TIMEOUT_MS = 60000;
const MAX_BUFFER = 1024 * 1024;

const escapeShellArg = (value: string): string => {
  return `'${value.replace(/'/g, `'\\''`)}'`;
};

/**
 * Convert Copilot CLI HTML output to clean markdown.
 * The CLI wraps responses in HTML like: ● <p>text</p> or <pre><code>...</code></pre>
 */
const cleanCopilotOutput = (raw: string): string => {
  let text = raw;

  // Remove the leading bullet marker (● )
  text = text.replace(/^●\s*/gm, '');

  // Convert HTML headings to markdown
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');

  // Convert HTML lists to markdown
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  text = text.replace(/<\/?[uo]l[^>]*>/gi, '\n');

  // Convert paragraphs to double newlines
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p[^>]*>/gi, '');

  // Convert <br> to newline
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Convert bold/italic
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

  // Convert code blocks
  text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n');
  text = text.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

  // Remove any remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

  // Clean up excessive blank lines (3+ → 2)
  text = text.replace(/\n{3,}/g, '\n\n');

  // Ensure bullet points are on separate lines
  // Pattern: text that starts with a known bullet pattern mid-line
  text = text.replace(/([^\n])(- [A-Z])/g, '$1\n$2');
  
  // Also handle cases where section content runs together after headings
  text = text.replace(/([^\n])(## )/g, '$1\n\n$2');

  // KEY FIX: Split on bold markers that indicate new bullet points
  // The CLI produces: "text **Bold title:** desc **Next title:** desc"
  // where colon can be inside OR outside the bold markers
  
  // Pattern 1: " **text:** desc" (colon inside bold) → most common from Copilot
  text = text.replace(/ \*\*([^*]+?:)\*\*/g, '\n- **$1**');
  
  // Pattern 2: " **text**: desc" (colon outside bold)
  text = text.replace(/ \*\*([^*]+)\*\*:/g, '\n- **$1**:');
  
  // If a line starts with **bold** treat it as a bullet point  
  text = text.replace(/^(\*\*[^*]+?\*\*)/gm, '- $1');
  
  // Handle first item in a section that is NOT bold but has "Title:" pattern
  // e.g. "Velocity declined sharply: description"
  text = text.replace(/^([A-Z][^:\n]{3,50}:)/gm, '- **$1**');
  
  // Also catch mid-paragraph topic shifts after sentences
  // e.g. "...some text. Teams needing attention: description"
  text = text.replace(/\. ([A-Z][^:\n]{3,50}:)/g, '.\n- **$1**');
  
  // Split paragraphs that contain multiple sentences about different topics
  // Pattern: "...end of sentence [A-Z]Team/Topic starts new sentence"
  // Only split if NOT already on its own line and looks like a new topic (after ". ")
  // This catches: "...practices. MVA-Siwa requires..." → split before MVA-Siwa
  text = text.replace(/([.;]) ([A-Z][A-Z0-9a-z-]+(?:\s(?:is|has|shows|requires|needs|remains|demonstrates|experienced|achieved|delivered|maintains|reports|indicates))\s)/g, '$1\n- **$2**');
  
  // Avoid double-bullet: "- - **" → "- **"
  text = text.replace(/^- - \*\*/gm, '- **');
  
  // Clean: if a "- " line is immediately after "## " heading with no blank line, add one
  text = text.replace(/(## [^\n]+)\n(- )/g, '$1\n\n$2');

  return text.trim();
};

export const runCopilotPrompt = async (prompt: string): Promise<string> => {
  const timeoutMs = Number.parseInt(process.env.COPILOT_CLI_TIMEOUT_MS || '', 10) || DEFAULT_TIMEOUT_MS;
  const usesPlaceholder = DEFAULT_COMMAND.includes('{prompt}');
  const command = usesPlaceholder
    ? DEFAULT_COMMAND.replace('{prompt}', escapeShellArg(prompt))
    : DEFAULT_COMMAND;

  return new Promise((resolve, reject) => {
    const child = exec(command, { timeout: timeoutMs, maxBuffer: MAX_BUFFER }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Copilot CLI failed: ${stderr || error.message}`));
        return;
      }
      resolve(cleanCopilotOutput(stdout));
    });

    if (!usesPlaceholder && child.stdin) {
      child.stdin.write(prompt);
      child.stdin.end();
    }
  });
};
