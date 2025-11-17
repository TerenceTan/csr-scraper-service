/**
 * Scraper module using Browserless.io for production scraping
 */
import { chromium } from 'playwright-core';
import { ENV } from './_core/env';

const BROWSERLESS_API_KEY = ENV.browserlessApiKey;

/**
 * Check if Browserless is configured
 */
function isBrowserlessConfigured(): boolean {
  return Boolean(BROWSERLESS_API_KEY);
}

/**
 * Get Browserless WebSocket endpoint
 */
function getBrowserlessEndpoint(): string {
  return `wss://production-sfo.browserless.io?token=${BROWSERLESS_API_KEY}`;
}

/**
 * Extract visible text content from a page in sequential HTML order
 */
async function extractContent(page: any) {
  // Pass function directly to page.evaluate to avoid string escaping issues
  return await page.evaluate(() => {
    const result: Array<{
      sectionType: string;
      sectionTitle: string | null;
      content: string;
      orderIndex: number;
    }> = [];
    let orderIndex = 0;
    const processedTexts = new Set<string>();

    const isVisible = (element: Element): boolean => {
      const style = window.getComputedStyle(element);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      );
    };

    const getCleanText = (element: Element): string => {
      return element.textContent?.trim() || '';
    };

    const isExcludedContent = (element: Element): boolean => {
      const tagName = element.tagName.toLowerCase();
      
      if (['nav', 'header', 'footer'].includes(tagName)) {
        return true;
      }
      
      const testId = element.getAttribute('data-testid') || '';
      const excludedTestIds = [
        'pui-disclaimer-banner',
        'pui-live-pricing'
      ];
      if (excludedTestIds.includes(testId)) {
        return true;
      }
      
      const className = typeof (element as any).className === 'string' ? (element as any).className : '';
      const id = (element as any).id || '';
      const combinedText = (className + ' ' + id).toLowerCase();
      
      const navFooterPatterns = [
        'nav', 'menu', 'header', 'footer', 'sidebar', 'breadcrumb',
        'cookie', 'banner', 'toolbar', 'topbar', 'bottombar'
      ];
      
      return navFooterPatterns.some(pattern => combinedText.includes(pattern));
    };

    const forceExpandableVisible = (): void => {
      const expandables = document.querySelectorAll('[data-testid="pui-expendable-banner"]');
      expandables.forEach(el => {
        (el as HTMLElement).style.opacity = '1';
        (el as HTMLElement).style.visibility = 'visible';
        (el as HTMLElement).style.display = 'block';
        const children = el.querySelectorAll('*');
        children.forEach(child => {
          (child as HTMLElement).style.opacity = '1';
          (child as HTMLElement).style.visibility = 'visible';
        });
      });
    };

    const extractTable = (table: Element): string => {
      const rows: string[] = [];
      const tableRows = table.querySelectorAll('tr');
      
      tableRows.forEach(tr => {
        const cells: string[] = [];
        const tableCells = tr.querySelectorAll('th, td');
        tableCells.forEach(cell => {
          const text = getCleanText(cell);
          if (text) cells.push(text);
        });
        if (cells.length > 0) {
          rows.push(cells.join(' | '));
        }
      });
      
      return rows.join(' || ');
    };

    const findMainContent = (): Element => {
      const mainSelectors = [
        'main',
        'article',
        '[role="main"]',
        '.main-content',
        '.content',
        '#content',
        '#main'
      ];
      
      for (const selector of mainSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          return element;
        }
      }
      
      return document.body;
    };

    const traverse = (element: Element): void => {
      if (!element || !element.tagName) return;
      
      const tagName = element.tagName.toLowerCase();
      if (['script', 'style', 'noscript', 'iframe', 'svg'].includes(tagName)) {
        return;
      }

      if (!isVisible(element)) {
        return;
      }
      
      if (isExcludedContent(element)) {
        return;
      }

      if (tagName === 'table') {
        const tableContent = extractTable(element);
        if (tableContent && !processedTexts.has(tableContent)) {
          processedTexts.add(tableContent);
          result.push({
            sectionType: 'table',
            sectionTitle: null,
            content: tableContent,
            orderIndex: orderIndex++,
          });
        }
        return;
      }

      const captureElements = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li'];
      
      if (captureElements.includes(tagName)) {
        const text = getCleanText(element);
        if (text && text.length > 0 && !processedTexts.has(text)) {
          processedTexts.add(text);
          result.push({
            sectionType: tagName,
            sectionTitle: tagName.startsWith('h') ? text : null,
            content: text,
            orderIndex: orderIndex++,
          });
        }
        return;
      }

      if (element.children) {
        for (let i = 0; i < element.children.length; i++) {
          traverse(element.children[i]);
        }
      }
    };

    forceExpandableVisible();
    const mainContent = findMainContent();
    if (mainContent) {
      traverse(mainContent);
    }

    return result;
  });
}

/**
 * Scrape a single URL using Browserless with timeout protection
 */
export async function scrapeUrl(url: string): Promise<{
  pageTitle: string;
  content: Array<{
    sectionType: string;
    sectionTitle: string | null;
    content: string;
    orderIndex: number;
    charCount: number;
  }>;
}> {
  if (!isBrowserlessConfigured()) {
    throw new Error('Browserless not configured. Please set BROWSERLESS_API_KEY environment variable.');
  }

  // Wrap entire scraping operation in a timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Scraping timeout after 2 minutes')), 120000);
  });

  const scrapePromise = (async () => {
    const browser = await chromium.connectOverCDP(getBrowserlessEndpoint());
    
    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Navigate to URL with timeout
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Wait a bit for dynamic content to load
      await page.waitForTimeout(2000);

      // Extract content
      const content = await extractContent(page);

      // Get page title
      const pageTitle = await page.title();

      // Close context
      await context.close();

      return {
        pageTitle,
        content: content.map((section: any) => ({
          ...section,
          charCount: section.content.length,
        })),
      };
    } finally {
      // Always disconnect browser
      await browser.close();
    }
  })();

  return Promise.race([scrapePromise, timeoutPromise]);
}
