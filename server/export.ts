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

    // Add Page URL at the top
    worksheet.addRow(['Page URL:', page.url]);
    worksheet.addRow([]); // Empty spacer row

    // Add header row with new structure
    const headerRow = worksheet.addRow([
      'Order',
      'Tag',
      'Source Text',
      'Word Count',
      'Translation'
    ]);

    // Set column widths
    worksheet.columns = [
      { key: 'order', width: 8 },
      { key: 'tag', width: 10 },
      { key: 'sourceText', width: 50 },
      { key: 'wordCount', width: 12 },
      { key: 'translation', width: 50 },
    ];

    // Style header row (now row 3)
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Sort content by orderIndex to maintain page sequence
    const sortedContent = [...page.content].sort((a, b) => a.orderIndex - b.orderIndex);

    // Helper function to convert HTML to Excel rich text
    const htmlToRichText = (html: string): ExcelJS.RichText[] => {
      const richText: ExcelJS.RichText[] = [];

      // Convert HTML entities
      html = html.replace(/&nbsp;/g, ' ');
      html = html.replace(/&amp;/g, '&');

      // Simple parser for HTML tags
      const regex = /<(\/?)(\w+)>/g;
      let lastIndex = 0;
      let currentFormatting: { bold?: boolean; underline?: boolean } = {};
      const formatStack: Array<{ tag: string; formatting: typeof currentFormatting }> = [];

      let match;
      while ((match = regex.exec(html)) !== null) {
        // Add text before tag
        if (match.index > lastIndex) {
          const text = html.substring(lastIndex, match.index);
          if (text) {
            richText.push({
              text: text,
              font: { ...currentFormatting }
            });
          }
        }

        const isClosing = match[1] === '/';
        const tag = match[2].toLowerCase();

        if (!isClosing) {
          // Opening tag - save current formatting and apply new
          formatStack.push({ tag, formatting: { ...currentFormatting } });

          if (tag === 'strong' || tag === 'b') {
            currentFormatting.bold = true;
          } else if (tag === 'u') {
            currentFormatting.underline = true;
          }
          // em and i tags are ignored (already removed by scraper)
        } else {
          // Closing tag - restore formatting
          const stackItem = formatStack.pop();
          if (stackItem) {
            currentFormatting = stackItem.formatting;
          }
        }

        lastIndex = regex.lastIndex;
      }

      // Add remaining text
      if (lastIndex < html.length) {
        const text = html.substring(lastIndex);
        if (text) {
          richText.push({
            text: text,
            font: { ...currentFormatting }
          });
        }
      }

      return richText.length > 0 ? richText : [{ text: html }];
    };

    // Add data rows
    sortedContent.forEach((section, index) => {
      // Calculate word count
      const wordCount = section.content.trim() ? section.content.trim().split(/\s+/).length : 0;

      const row = worksheet.addRow({
        order: index + 1,
        tag: section.sectionType,
        sourceText: '', // Will set richText below
        wordCount: wordCount,
        translation: '',
      });

      // Apply rich text formatting to source text
      const sourceCell = row.getCell('sourceText');
      sourceCell.value = {
        richText: htmlToRichText(section.content)
      };
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
    'Word Count',
    'Translation',
  ]);

  // Add data rows
  for (const page of pagesWithContent) {
    // Sort content by orderIndex to maintain page sequence
    const sortedContent = [...page.content].sort((a, b) => a.orderIndex - b.orderIndex);

    sortedContent.forEach((section, index) => {
      // Calculate word count
      const wordCount = section.content.trim() ? section.content.trim().split(/\s+/).length : 0;

      rows.push([
        page.url,
        (index + 1).toString(), // Sequential order starting from 1
        section.sectionType, // HTML tag name
        section.content,
        wordCount.toString(),
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
