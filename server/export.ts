import ExcelJS from 'exceljs';
import * as db from './db';

/**
 * Generate Excel file with multiple sheets (one per URL)
 */
export async function generateExcel(jobId: number): Promise<Buffer> {
  const pagesWithContent = await db.getJobContent(jobId);

  const workbook = new ExcelJS.Workbook();

  for (const page of pagesWithContent) {
    // Create sheet name from page title or URL
    let sheetName = page.pageTitle || page.url;
    // Excel sheet names have a 31 character limit
    if (sheetName.length > 31) {
      sheetName = sheetName.substring(0, 28) + '...';
    }
    // Remove invalid characters for sheet names
    sheetName = sheetName.replace(/[:\\/?*\[\]]/g, '-');

    const worksheet = workbook.addWorksheet(sheetName);

    // Add header row
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Section', key: 'section', width: 20 },
      { header: 'Source Text', key: 'sourceText', width: 50 },
      { header: 'Context', key: 'context', width: 30 },
      { header: 'Char Count', key: 'charCount', width: 12 },
      { header: 'Translation', key: 'translation', width: 50 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data rows
    page.content.forEach((section) => {
      worksheet.addRow({
        id: section.id,
        section: section.sectionTitle || section.sectionType,
        sourceText: section.content,
        context: section.context || '',
        charCount: section.charCount,
        translation: '', // Empty column for translator to fill
      });
    });

    // Auto-fit columns (with min/max limits)
    worksheet.columns.forEach((column) => {
      if (column.eachCell) {
        let maxLength = 0;
        column.eachCell({ includeEmpty: false }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(Math.max(maxLength + 2, 10), 80);
      }
    });
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate CSV file with all content (single file)
 */
export async function generateCSV(jobId: number): Promise<string> {
  const pagesWithContent = await db.getJobContent(jobId);

  const rows: string[][] = [];

  // Add header row
  rows.push([
    'ID',
    'Page URL',
    'Section',
    'Source Text',
    'Context',
    'Char Count',
    'Translation',
  ]);

  // Add data rows
  for (const page of pagesWithContent) {
    for (const section of page.content) {
      rows.push([
        section.id.toString(),
        page.url,
        section.sectionTitle || section.sectionType,
        section.content,
        section.context || '',
        section.charCount.toString(),
        '', // Empty column for translator to fill
      ]);
    }
  }

  // Convert to CSV format
  const csvContent = rows
    .map((row) =>
      row.map((cell) => {
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    )
    .join('\n');

  return csvContent;
}
