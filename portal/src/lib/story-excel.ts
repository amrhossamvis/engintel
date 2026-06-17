/**
 * story-excel.ts
 *
 * Client-side Excel export for Story Extractor user stories.
 * Uses SheetJS (xlsx) which is already a project dependency.
 *
 * Each story becomes one row. Acceptance criteria are joined with a
 * newline separator so they read naturally inside a single cell.
 */

import * as XLSX from 'xlsx';
import { StoryUserStory } from '@/types';

interface ExportRow {
  '#': number;
  'Epic / Module': string;
  Title: string;
  Description: string;
  'Acceptance Criteria': string;
  'Story ID': string;
}

/**
 * Export one or more stories to an .xlsx file and trigger a browser download.
 *
 * @param stories    Array of stories to export
 * @param moduleName Module / epic name used for the sheet title and filename
 * @param epicName   Epic label shown in the "Epic / Module" column
 */
export function exportStoriesToExcel(
  stories: StoryUserStory[],
  moduleName: string,
  epicName: string
): void {
  const rows: ExportRow[] = stories.map((s, i) => ({
    '#': i + 1,
    'Epic / Module': epicName || moduleName,
    Title: s.title,
    Description: s.description,
    'Acceptance Criteria': s.acceptanceCriteria
      .map((c, j) => `${j + 1}. ${c}`)
      .join('\n'),
    'Story ID': s.id,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Column widths (in characters)
  worksheet['!cols'] = [
    { wch: 4 },   // #
    { wch: 28 },  // Epic / Module
    { wch: 45 },  // Title
    { wch: 60 },  // Description
    { wch: 80 },  // Acceptance Criteria
    { wch: 38 },  // Story ID
  ];

  // Enable text wrap on all data cells so multi-line AC reads properly
  const range = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1');
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!worksheet[cellAddr]) continue;
      worksheet[cellAddr].s = {
        alignment: { wrapText: true, vertical: 'top' },
      };
    }
  }

  const workbook = XLSX.utils.book_new();
  const sheetName = (moduleName || 'Stories').slice(0, 31); // Excel sheet name limit
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const safeModule = (moduleName || 'stories').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `story-extractor_${safeModule}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  XLSX.writeFile(workbook, filename);
}
