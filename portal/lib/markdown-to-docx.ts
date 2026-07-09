/**
 * Client-side markdown → .docx conversion for Wiki Weaver's "Export as Word"
 * action. Runs entirely in the browser against the already-generated content
 * held in component state — no server round-trip needed. Supports the same
 * markdown subset as lib/markdown.ts (headings, pipe tables, lists, inline
 * bold/italic/code), rendered as native Word elements instead of HTML.
 */

import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const NUMBERING_REFERENCE = "wiki-weaver-numbered-list";

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

type InlineToken = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) tokens.push({ text: text.slice(lastIndex, match.index) });
    const token = match[0];
    if (token.startsWith("**")) tokens.push({ text: token.slice(2, -2), bold: true });
    else if (token.startsWith("`")) tokens.push({ text: token.slice(1, -1), code: true });
    else tokens.push({ text: token.slice(1, -1), italic: true });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) tokens.push({ text: text.slice(lastIndex) });
  return tokens.length ? tokens : [{ text }];
}

function toTextRuns(text: string, forceBold = false): TextRun[] {
  return parseInline(text).map(
    (t) =>
      new TextRun({
        text: t.text,
        bold: forceBold || t.bold,
        italics: t.italic,
        font: t.code ? "Consolas" : undefined,
      }),
  );
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

function buildCell(text: string, header = false): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: toTextRuns(text, header) })],
    width: { size: 100, type: WidthType.PERCENTAGE },
    shading: header ? { fill: "F2F2F2" } : undefined,
  });
}

/** Convert Wiki Weaver's generated markdown into a downloadable .docx Blob. */
export async function markdownToDocxBlob(markdown: string): Promise<Blob> {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const children: (Paragraph | Table)[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = Math.min(h[1].length, 6) - 1;
      children.push(new Paragraph({ children: toTextRuns(h[2].trim()), heading: HEADING_LEVELS[level] }));
      i++;
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = splitTableRow(line);
      i += 2; // header + separator row
      const bodyRows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }
      const headerRow = new TableRow({
        children: headerCells.map((c) => buildCell(c, true)),
        tableHeader: true,
      });
      const rows = bodyRows.map((r) => new TableRow({ children: r.map((c) => buildCell(c)) }));
      children.push(new Table({ rows: [headerRow, ...rows], width: { size: 100, type: WidthType.PERCENTAGE } }));
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      children.push(new Paragraph({ children: toTextRuns(bullet[1]), bullet: { level: 0 } }));
      i++;
      continue;
    }

    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (numbered) {
      children.push(new Paragraph({ children: toTextRuns(numbered[1]), numbering: { reference: NUMBERING_REFERENCE, level: 0 } }));
      i++;
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    children.push(new Paragraph({ children: toTextRuns(line) }));
    i++;
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: NUMBERING_REFERENCE,
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START }],
        },
      ],
    },
    sections: [{ properties: {}, children }],
  });

  return Packer.toBlob(doc);
}

/** Trigger a browser download of the given Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
