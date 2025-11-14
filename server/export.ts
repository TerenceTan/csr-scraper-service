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

    // Add header row with new structure
    worksheet.columns = [
      { header: 'Order', key: 'order', width: 8 },
      { header: 'Tag', key: 'tag', width: 10 },
      { header: 'Source Text', key: 'sourceText', width: 50 },
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

    // Sort content by orderIndex to maintain page sequence
    const sortedContent = [...page.content].sort((a, b) => a.orderIndex - b.orderIndex);

    // Add data rows
    sortedContent.forEach((section, index) => {
      worksheet.addRow({
        order: index + 1, // Sequential order starting from 1
        tag: section.sectionType, // HTML tag name (h1, h2, p, li, etc.)
        sourceText: section.content,
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

  // Add header row with new structure
  rows.push([
    'Page URL',
    'Order',
    'Tag',
    'Source Text',
    'Char Count',
    'Translation',
  ]);

  // Add data rows
  for (const page of pagesWithContent) {
    // Sort content by orderIndex to maintain page sequence
    const sortedContent = [...page.content].sort((a, b) => a.orderIndex - b.orderIndex);
    
    sortedContent.forEach((section, index) => {
      rows.push([
        page.url,
        (index + 1).toString(), // Sequential order starting from 1
        section.sectionType, // HTML tag name
        section.content,
        section.charCount.toString(),
        '', // Empty for translation
      ]);
    });
  }

  // Convert to CSV format
  return rows
    .map((row) =>
      row
        .map((cell) => {
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          const escaped = cell.replace(/"/g, '""');
          return /[",\n]/.test(cell) ? `"${escaped}"` : escaped;
        })
        .join(',')
    )
    .join('\n');
}
