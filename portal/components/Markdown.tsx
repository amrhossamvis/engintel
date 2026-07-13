import { Fragment, type ReactNode } from "react";

/**
 * Minimal, injection-safe markdown renderer. Builds React nodes directly — no
 * dangerouslySetInnerHTML — so stored SKILL.md / generated-content markdown
 * can never inject markup. Supports the subset SKILL.md and Wiki Weaver's
 * generated pages use: h1-4, fenced code, ul/ol, blockquote, pipe tables,
 * paragraphs, and inline bold / italic / code / links.
 */
export function Markdown({ source }: { source: string }) {
  return <div className="md space-y-4">{renderBlocks(source)}</div>;
}

function isTableRow(line: string): boolean {
  return /^\s*\|.*\|\s*$/.test(line);
}
function isTableSeparator(line: string): boolean {
  return /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(line);
}
function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function renderBlocks(src: string): ReactNode[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      out.push(
        <pre key={key++} className="overflow-x-auto rounded-xl border p-4 text-xs"
          style={{ borderColor: "var(--hairline)", background: "var(--panel-2)" }}>
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls =
        level === 1 ? "font-display text-2xl font-bold mt-2"
        : level === 2 ? "font-display text-xl font-semibold mt-2"
        : level === 3 ? "font-display text-lg font-semibold"
        : "font-semibold";
      out.push(
        <p key={key++} className={cls}>{renderInline(h[2])}</p>,
      );
      i++;
      continue;
    }

    // Table (pipe-delimited header row + |---|---| separator + body rows)
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = splitTableRow(line);
      i += 2; // header + separator row
      const bodyRows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) bodyRows.push(splitTableRow(lines[i++]));
      out.push(
        <div key={key++} className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                {headerCells.map((c, ci) => (
                  <th key={ci} className="border px-2.5 py-1.5 text-left font-semibold" style={{ borderColor: "var(--hairline)" }}>
                    {renderInline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((c, ci) => (
                    <td key={ci} className="border px-2.5 py-1.5 align-top" style={{ borderColor: "var(--hairline)" }}>
                      {renderInline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(
        <blockquote key={key++} className="border-l-2 pl-4 text-muted"
          style={{ borderColor: "var(--hairline-strong)" }}>
          {renderInline(buf.join(" "))}
        </blockquote>,
      );
      continue;
    }

    // Lists (ordered / unordered)
    const isUl = /^[-*]\s+/.test(line);
    const isOl = /^\d+\.\s+/.test(line);
    if (isUl || isOl) {
      const items: string[] = [];
      const match = isUl ? /^[-*]\s+/ : /^\d+\.\s+/;
      while (i < lines.length && match.test(lines[i])) items.push(lines[i++].replace(match, ""));
      const inner = items.map((it, idx) => <li key={idx}>{renderInline(it)}</li>);
      out.push(
        isOl
          ? <ol key={key++} className="list-decimal space-y-1 pl-6">{inner}</ol>
          : <ul key={key++} className="list-disc space-y-1 pl-6">{inner}</ul>,
      );
      continue;
    }

    // Paragraph — gather until blank line
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,4}\s|```|>|[-*]\s|\d+\.\s)/.test(lines[i]))
      buf.push(lines[i++]);
    out.push(<p key={key++} className="text-sm leading-relaxed">{renderInline(buf.join(" "))}</p>);
  }

  return out;
}

/** Inline: `code`, **bold**, *italic*, [text](url). Scanned left-to-right. */
function renderInline(text: string): ReactNode {
  const tokens: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith("`")) {
      tokens.push(<code key={key++} className="rounded bg-[var(--panel-2)] px-1 py-0.5 text-[0.85em]">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("**")) {
      tokens.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("*")) {
      tokens.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    } else {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      const href = /^https?:\/\//.test(lm[2]) ? lm[2] : "#";
      tokens.push(
        <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="text-red underline">
          {lm[1]}
        </a>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) tokens.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return tokens;
}
