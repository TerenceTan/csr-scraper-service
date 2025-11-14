import { chromium, Browser, Page } from 'playwright';

let browser: Browser | null = null;

/**
 * Initialize the browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browser;
}

/**
 * Close the browser instance
 */
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Extract visible text content from a page
 */
async function extractContent(page: Page) {
  // Use a string-based evaluation to avoid transpilation issues
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
 * Scrape a single URL and extract its content
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
  const browserInstance = await getBrowser();
  const context = await browserInstance.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // Navigate to the URL
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // Wait a bit more for any lazy-loaded content
    await page.waitForTimeout(2000);

    // Get page title
    const pageTitle = await page.title();

    // Extract content
    const rawContent: any = await extractContent(page);

    // Add character count to each section
    const content = rawContent.map((section: any) => ({
      ...section,
      charCount: section.content.length,
    }));

    return { pageTitle, content };
  } finally {
    await context.close();
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
