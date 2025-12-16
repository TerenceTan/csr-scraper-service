import ExcelJS from 'exceljs';
import * as db from './db';

/**
 * Strip HTML tags from content and decode entities
 */
function stripHtmlTags(html: string): string {
  if (!html) return '';
  
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');
  
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&apos;/g, "'");
  
  // Clean up extra whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Generate Excel file with multiple sheets (one per URL)
 */
export async function generateExcel(jobId: number): Promise<Buffer> {
  const pagesWithContent = await db.getJobContent(jobId);

  const workbook = new ExcelJS.Workbook();

  const usedSheetNames = new Set<string>();

  for (const page of pagesWithContent) {
    // Create sheet name from page title or URL
    let baseSheetName = page.pageTitle || page.url;

    // Remove invalid characters for sheet names
    baseSheetName = baseSheetName.replace(/[:\\/?*\[\]]/g, '-');

    // Excel sheet names have a 31 character limit
    // We reserve 5 chars for potential suffix " (99)"
    if (baseSheetName.length > 26) {
      baseSheetName = baseSheetName.substring(0, 26) + '...';
    }

    let sheetName = baseSheetName;
    let counter = 1;

    // Handle duplicates
    while (usedSheetNames.has(sheetName)) {
      sheetName = `${baseSheetName} (${counter})`;
      // If adding suffix pushes over 31 chars, truncate base further
      if (sheetName.length > 31) {
        const suffix = ` (${counter})`;
        const maxBaseLength = 31 - suffix.length;
        sheetName = baseSheetName.substring(0, maxBaseLength) + suffix;
      }
      counter++;
    }

    usedSheetNames.add(sheetName);

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

      // Convert HTML entities first
      html = html.replace(/&nbsp;/g, ' ');
      html = html.replace(/&amp;/g, '&');
      html = html.replace(/&lt;/g, '<');
      html = html.replace(/&gt;/g, '>');
      html = html.replace(/&quot;/g, '"');
      html = html.replace(/&#39;/g, "'");
      html = html.replace(/&apos;/g, "'");
      
      // Replace <br>, <br/>, <br /> with newline
      html = html.replace(/<br\s*\/?>/gi, '\n');
      
      // Replace block-level tags with spacing to prevent words sticking together
      // These tags naturally create visual breaks
      html = html.replace(/<\/(p|div|li|h[1-6]|tr|td|th)>/gi, ' ');
      html = html.replace(/<(p|div|li|h[1-6]|tr|td|th)(?:\s[^>]*)?>/gi, '');
      
      // Remove other non-formatting tags but preserve their content
      // Keep: strong, b, u, a, i, em (for formatting)
      // Remove: span, font, sub, sup, etc.
      html = html.replace(/<\/?(span|font|sub|sup|small|big|mark|del|ins|s|strike|abbr|cite|code|kbd|samp|var|dfn|q)(?:\s[^>]*)?>/gi, '');

      // Parser for formatting tags (handles tags with attributes like <a href="...">)
      const regex = /<(\/?)(\w+)(?:[^>]*)>/g;
      let lastIndex = 0;
      let currentFormatting: { bold?: boolean; underline?: boolean; italic?: boolean } = {};
      const formatStack: Array<{ tag: string; formatting: typeof currentFormatting }> = [];

      let match;
      while ((match = regex.exec(html)) !== null) {
        // Add text before tag (preserve spaces!)
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
          } else if (tag === 'u' || tag === 'a') {
            // Underline for <u> and <a> tags
            currentFormatting.underline = true;
          } else if (tag === 'i' || tag === 'em') {
            // Italic for <i> and <em> tags
            currentFormatting.italic = true;
          }
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

      // If no rich text segments created, return plain text
      if (richText.length === 0) {
        return [{ text: html }];
      }
      
      // Filter out empty text segments but keep segments with only spaces
      return richText.filter(rt => rt.text && rt.text.length > 0);
    };

    // Add data rows
    sortedContent.forEach((section, index) => {
      // Calculate word count from plain text
      const plainText = stripHtmlTags(section.content);
      const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;

      const row = worksheet.addRow({
        order: index + 1,
        tag: section.sectionType,
        sourceText: '', // Will set below
        wordCount: wordCount,
        translation: '',
      });

      // Apply rich text formatting to all content
      // This converts HTML tags to Excel formatting:
      // <strong>/<b> → Bold, <u>/<a> → Underline, <i>/<em> → Italic
      const sourceCell = row.getCell('sourceText');
      const richTextContent = htmlToRichText(section.content);
      
      // If rich text has content, use it; otherwise fall back to plain text
      if (richTextContent.length > 0) {
        sourceCell.value = { richText: richTextContent };
      } else {
        sourceCell.value = plainText;
      }
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
      // Strip HTML tags from all content for CSV (CSV doesn't support formatting)
      const plainText = stripHtmlTags(section.content);
      const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;

      rows.push([
        page.url,
        (index + 1).toString(), // Sequential order starting from 1
        section.sectionType, // HTML tag name
        plainText, // Plain text without HTML tags
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
