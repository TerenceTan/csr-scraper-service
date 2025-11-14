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
 * Extract visible text content from a page
 */
async function extractContent(page: any) {
  const extractionScript = `
    (() => {
      const result = [];
      let orderIndex = 0;

      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0' &&
          element.offsetParent !== null
        );
      };

      const getCleanText = (element) => {
        return element.textContent?.trim() || '';
      };

      // Extract headings (h1-h6)
      const headingSelectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      headingSelectors.forEach((selector) => {
        const headings = document.querySelectorAll(selector);
        headings.forEach((heading) => {
          if (isVisible(heading)) {
            const text = getCleanText(heading);
            if (text) {
              result.push({
                sectionType: selector,
                sectionTitle: text,
                content: text,
                orderIndex: orderIndex++,
              });
            }
          }
        });
      });

      // Extract paragraphs
      const paragraphs = document.querySelectorAll('p');
      paragraphs.forEach((p) => {
        if (isVisible(p)) {
          const text = getCleanText(p);
          if (text) {
            result.push({
              sectionType: 'p',
              sectionTitle: null,
              content: text,
              orderIndex: orderIndex++,
            });
          }
        }
      });

      // Extract list items
      const listItems = document.querySelectorAll('li');
      listItems.forEach((li) => {
        if (isVisible(li)) {
          const text = getCleanText(li);
          if (text) {
            result.push({
              sectionType: 'li',
              sectionTitle: null,
              content: text,
              orderIndex: orderIndex++,
            });
          }
        }
      });

      // Extract other text elements
      const textElements = document.querySelectorAll('span, div, a, button, label');
      textElements.forEach((element) => {
        const hasBlockChildren = element.querySelector('p, h1, h2, h3, h4, h5, h6, li, div');
        if (!hasBlockChildren && isVisible(element)) {
          const text = getCleanText(element);
          if (text && text.length > 3) {
            const alreadyCaptured = result.some((item) => item.content === text);
            if (!alreadyCaptured) {
              result.push({
                sectionType: element.tagName.toLowerCase(),
                sectionTitle: null,
                content: text,
                orderIndex: orderIndex++,
              });
            }
          }
        }
      });

      return result.sort((a, b) => a.orderIndex - b.orderIndex);
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

  console.log(`[Scraper] Connecting to Browserless...`);
  const endpoint = getBrowserlessEndpoint();
  console.log(`[Scraper] Endpoint: ${endpoint.replace(BROWSERLESS_API_KEY, '***')}`);
  
  let browser;
  try {
    browser = await chromium.connectOverCDP(endpoint);
    console.log(`[Scraper] Connected successfully`);
  } catch (error) {
    console.error(`[Scraper] Connection failed:`, error);
    throw new Error(`Failed to connect to Browserless: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  try {
    const page = await browser.newPage();

    // Navigate with fallback strategies
    try {
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
    } catch (error) {
      console.log(`[Scraper] Network idle timeout for ${url}, trying domcontentloaded...`);
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    }

    // Wait for lazy-loaded content
    await page.waitForTimeout(3000);

    // Get page title
    const pageTitle = (await page.title()) || 'Untitled';

    // Extract content
    const rawContent = await extractContent(page);

    // Add character count
    const content = rawContent.map((section: any) => ({
      ...section,
      charCount: section.content.length,
    }));

    await page.close();

    return { pageTitle, content };
  } catch (error) {
    console.error(`[Scraper] Error scraping ${url}:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * Scrape multiple URLs
 */
export async function scrapeUrls(urls: string[]): Promise<
  Array<{
    url: string;
    success: boolean;
    pageTitle?: string;
    content?: Array<{
      sectionType: string;
      sectionTitle: string | null;
      content: string;
      orderIndex: number;
      charCount: number;
    }>;
    error?: string;
  }>
> {
  const results = [];

  for (const url of urls) {
    try {
      const { pageTitle, content } = await scrapeUrl(url);
      results.push({
        url,
        success: true,
        pageTitle,
        content,
      });
    } catch (error) {
      results.push({
        url,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}
