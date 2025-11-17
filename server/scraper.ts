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
  const extractionScript = `
    (() => {
      const result = [];
      let orderIndex = 0;
      const processedTexts = new Set();

      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        // Simplified visibility check - offsetParent can be null for visible elements
        // with position:fixed or CSS transforms
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden'
        );
      };

      const getCleanText = (element) => {
        return element.textContent?.trim() || '';
      };

      // Check if element should be excluded (navigation, footer, banners)
      const isExcludedContent = (element) => {
        const tagName = element.tagName.toLowerCase();
        
        // Skip nav, header, footer tags
        if (['nav', 'header', 'footer'].includes(tagName)) {
          return true;
        }
        
        // Check for specific data-testid attributes to exclude
        const testId = element.getAttribute('data-testid') || '';
        const excludedTestIds = [
          'pui-disclaimer-banner',
          'pui-live-pricing'
        ];
        if (excludedTestIds.includes(testId)) {
          return true;
        }
        
        // Check for common navigation/footer class names and IDs
        // Handle SVG elements where className is an object
        const className = typeof element.className === 'string' ? element.className : '';
        const id = element.id || '';
        const combinedText = (className + ' ' + id).toLowerCase();
        
        const navFooterPatterns = [
          'nav', 'menu', 'header', 'footer', 'sidebar', 'breadcrumb',
          'cookie', 'banner', 'toolbar', 'topbar', 'bottombar'
        ];
        
        return navFooterPatterns.some(pattern => combinedText.includes(pattern));
      };

      // Force expandable content to be visible
      const forceExpandableVisible = () => {
        // Find all expandable banners and force them visible
        const expandables = document.querySelectorAll('[data-testid="pui-expendable-banner"]');
        expandables.forEach(el => {
          el.style.opacity = '1';
          el.style.visibility = 'visible';
          el.style.display = 'block';
          // Also force all children visible
          const children = el.querySelectorAll('*');
          children.forEach(child => {
            child.style.opacity = '1';
            child.style.visibility = 'visible';
          });
        });
      };

      // Extract table content
      const extractTable = (table) => {
        const rows = [];
        const tableRows = table.querySelectorAll('tr');
        
        tableRows.forEach(tr => {
          const cells = [];
          const tableCells = tr.querySelectorAll('th, td');
          tableCells.forEach(cell => {
            const text = getCleanText(cell);
            if (text) cells.push(text);
          });
          if (cells.length > 0) {
            rows.push(cells.join(' | '));
          }
        });
        
        return rows.join('\n');
      };

      // Find main content area
      const findMainContent = () => {
        // Try to find main content container
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
        
        // Fallback to body if no main content found
        return document.body;
      };

      // Traverse DOM tree in document order (depth-first)
      const traverse = (element) => {
        if (!element || !element.tagName) return;
        
        // Skip script, style, and hidden elements
        const tagName = element.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'iframe', 'svg'].includes(tagName)) {
          return;
        }

        if (!isVisible(element)) {
          return;
        }
        
        // Skip excluded content (navigation, footer, banners)
        if (isExcludedContent(element)) {
          return;
        }

        // Handle tables
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
          // Don't traverse children (already extracted table content)
          return;
        }

        // Elements we want to capture
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
          // Don't traverse children of these elements (already captured their text)
          return;
        }

        // Recursively traverse children for other elements
        if (element.children) {
          for (let i = 0; i < element.children.length; i++) {
            traverse(element.children[i]);
          }
        }
      };

      // Force expandable content visible first
      forceExpandableVisible();
      
      // Start traversal from main content area
      const mainContent = findMainContent();
      if (mainContent) {
        traverse(mainContent);
      }

      return result;
    })()
  `;

  return await page.evaluate(extractionScript);
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
    throw new Error(
      'Browserless not configured. Please set BROWSERLESS_API_KEY environment variable.'
    );
  }

  // Wrap entire scraping operation in a timeout (2 minutes max)
  return Promise.race([
    scrapeUrlInternal(url),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Scraping timeout after 120 seconds')), 120000)
    )
  ]);
}

/**
 * Internal scraping implementation
 */
async function scrapeUrlInternal(url: string): Promise<{
  pageTitle: string;
  content: Array<{
    sectionType: string;
    sectionTitle: string | null;
    content: string;
    orderIndex: number;
    charCount: number;
  }>;
}> {
  console.log('[Scraper] Connecting to Browserless...');
  const endpoint = getBrowserlessEndpoint();
  console.log('[Scraper] Endpoint:', endpoint.replace(BROWSERLESS_API_KEY!, '***'));

  let browser;
  try {
    browser = await chromium.connectOverCDP(endpoint);
    console.log('[Scraper] Connected successfully');
  } catch (error) {
    console.error('[Scraper] Failed to connect to Browserless:', error);
    throw new Error(`Failed to connect to Browserless: ${error}`);
  }

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`[Scraper] Navigating to ${url}...`);
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', // Changed from 'networkidle' to be more reliable
        timeout: 60000 
      });
      console.log('[Scraper] Page loaded');
    } catch (error) {
      console.error('[Scraper] Navigation failed:', error);
      throw new Error(`Failed to navigate to ${url}: ${error}`);
    }

    // Wait for content to render
    await page.waitForTimeout(3000);

    // Get page title
    const pageTitle = await page.title();
    console.log(`[Scraper] Page title: ${pageTitle}`);

    // Extract content
    console.log('[Scraper] Extracting content...');
    const rawContent = await extractContent(page);
    console.log(`[Scraper] Extracted ${rawContent.length} sections`);

    // Add character count
    const content = rawContent.map((section: any) => ({
      ...section,
      charCount: section.content.length,
    }));

    await context.close();
    console.log('[Scraper] Context closed');

    return { pageTitle, content };
  } finally {
    if (browser) {
      await browser.close();
      console.log('[Scraper] Browser closed');
    }
  }
}
