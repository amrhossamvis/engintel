/**
 * Server-only .docx → plain text extraction. Never import from a "use client" file.
 *
 * .docx is a ZIP of WordprocessingML XML parts. Ported from the regex/stdlib-only
 * approach in the Feature Breakdown pipeline script's extract_docx_text /
 * _docx_xml_to_text (ElementTree-based there; regex-based here since Node has no
 * stdlib XML parser and these WordML tags don't need a full DOM to read).
 */

import JSZip from "jszip";

const WORD_XML_PARTS = ["word/document.xml", "word/footnotes.xml", "word/endnotes.xml", "word/comments.xml"];
const HEADER_FOOTER_PATTERN = /^word\/(header|footer)\d+\.xml$/;

// Matches, in document order within a paragraph: a <w:t>text</w:t> run, a
// self-closing <w:tab/>, or a <w:br/>/<w:cr/> line break. Namespace prefixes on
// these elements are always "w:" in practice, so match that literally rather
// than building a namespace-aware parser for a handful of known tags.
const RUN_TOKEN_PATTERN = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:(?:br|cr)\b[^>]*\/>/g;
const PARAGRAPH_PATTERN = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function xmlToText(xml: string): string {
  const paragraphs: string[] = [];
  let paragraphMatch: RegExpExecArray | null;
  PARAGRAPH_PATTERN.lastIndex = 0;

  while ((paragraphMatch = PARAGRAPH_PATTERN.exec(xml))) {
    const body = paragraphMatch[1];
    const chunks: string[] = [];
    let tokenMatch: RegExpExecArray | null;
    RUN_TOKEN_PATTERN.lastIndex = 0;

    while ((tokenMatch = RUN_TOKEN_PATTERN.exec(body))) {
      if (tokenMatch[1] !== undefined) {
        chunks.push(decodeXmlEntities(tokenMatch[1]));
      } else if (tokenMatch[0].includes("w:tab")) {
        chunks.push("\t");
      } else {
        chunks.push("\n");
      }
    }

    const paragraphText = chunks.join("").trim();
    if (paragraphText) paragraphs.push(paragraphText);
  }

  return paragraphs
    .join("\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function partLabel(partName: string): string {
  const stem = partName.split("/").pop()!.replace(/\.xml$/, "");
  return stem
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Extract readable text from a .docx file's bytes. Reads the main document body
 * plus headers/footers/footnotes/endnotes/comments when present. Throws only
 * when the input isn't a valid ZIP package; missing/unreadable individual parts
 * are skipped rather than failing the whole extraction.
 */
export async function extractDocxText(docxBytes: Buffer | ArrayBuffer): Promise<string> {
  if (!docxBytes || (docxBytes as Buffer).byteLength === 0) return "";

  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(docxBytes);
  } catch {
    throw new Error("Attachment is not a valid .docx ZIP package");
  }

  const available = Object.keys(archive.files);
  const orderedParts = [
    ...WORD_XML_PARTS.filter((p) => available.includes(p)),
    ...available.filter((p) => HEADER_FOOTER_PATTERN.test(p)).sort(),
  ];

  const extracted: string[] = [];
  for (const partName of orderedParts) {
    try {
      const xml = await archive.file(partName)?.async("string");
      if (!xml) continue;
      const partText = xmlToText(xml);
      if (partText) extracted.push(`## ${partLabel(partName)}\n\n${partText}`);
    } catch {
      continue;
    }
  }

  return extracted.join("\n\n").trim();
}
