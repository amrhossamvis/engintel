/**
 * story-excel.ts
 *
 * Client-side Excel export for Story Extractor user stories.
 * Uses ExcelJS (actively maintained, no known vulnerabilities).
 *
 * Each story becomes one row. Acceptance criteria are joined with a
 * newline separator so they read naturally inside a single cell.
 */

import ExcelJS from 'exceljs';
import { StoryUserStory } from '@/types';

/**
 * Export one or more stories to an .xlsx file and trigger a browser download.
 *
 * @param stories    Array of stories to export
 * @param moduleName Module / epic name used for the sheet title and filename
 * @param epicName   Epic label shown in the "Epic / Module" column
 */
export async function exportStoriesToExcel(
  stories: StoryUserStory[],
  moduleName: string,
  epicName: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Engineering Intelligence Hub';
  workbook.created = new Date();

  const sheetName = (moduleName || 'Stories').slice(0, 31); // Excel sheet name limit
  const worksheet = workbook.addWorksheet(sheetName);

  // ── Column definitions ────────────────────────────────────────────────────
  worksheet.columns = [
    { header: '#',                  key: 'index',    width: 5  },
    { header: 'Epic / Module',      key: 'epic',     width: 30 },
    { header: 'Title',              key: 'title',    width: 48 },
    { header: 'Description',        key: 'desc',     width: 62 },
    { header: 'Acceptance Criteria',key: 'ac',       width: 82 },
    { header: 'Story ID',           key: 'id',       width: 40 },
  ];

  // ── Header row styling ────────────────────────────────────────────────────
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE60000' }, // Vodafone red
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 20;

  // ── Data rows ─────────────────────────────────────────────────────────────
  stories.forEach((s, i) => {
    const row = worksheet.addRow({
      index: i + 1,
      epic:  epicName || moduleName,
      title: s.title,
      desc:  s.description,
      ac:    s.acceptanceCriteria.map((c, j) => `${j + 1}. ${c}`).join('\n'),
      id:    s.id,
    });

    // Wrap text and align to top for all cells in this row
    row.eachCell((cell) => {
      cell.alignment = { wrapText: true, vertical: 'top' };
    });

    // Alternate row background for readability
    if (i % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9F9F9' },
        };
      });
    }
  });

  // ── Trigger browser download ──────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeModule = (moduleName || 'stories').replace(/[^a-zA-Z0-9_-]/g, '_');
  a.href = url;
  a.download = `story-extractor_${safeModule}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
