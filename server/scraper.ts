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

      // Check if element is likely navigation or footer content
      const isNavigationOrFooter = (element) => {
        const tagName = element.tagName.toLowerCase();
        
        // Skip nav, header, footer tags
        if (['nav', 'header', 'footer'].includes(tagName)) {
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
        
        // Skip navigation and footer content
        if (isNavigationOrFooter(element)) {
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
 * Scrape a single URL using Browserless
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

  console.log('[Scraper] Connecting to Browserless...');
  const endpoint = getBrowserlessEndpoint();
  console.log('[Scraper] Endpoint:', endpoint.replace(BROWSERLESS_API_KEY!, '***'));

  const browser = await chromium.connectOverCDP(endpoint);
  console.log('[Scraper] Connected successfully');

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`[Scraper] Navigating to ${url}...`);
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    console.log('[Scraper] Page loaded');

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

    return { pageTitle, content };
  } finally {
    await browser.close();
  }
}
