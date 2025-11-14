import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'change-this-in-production';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

let browser = null;

// Initialize browser on startup
async function initBrowser() {
  if (!browser) {
    console.log('[Scraper] Launching browser...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    console.log('[Scraper] Browser ready');
  }
  return browser;
}

// Extract visible text content from a page
async function extractContent(page) {
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

// Scrape a single URL
async function scrapeUrl(url) {
  const browserInstance = await initBrowser();
  const context = await browserInstance.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
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
    const content = rawContent.map((section) => ({
      ...section,
      charCount: section.content.length,
    }));

    return { success: true, pageTitle, content };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  } finally {
    await context.close();
  }
}

// API key middleware
function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'scraping-service' });
});

// Scrape endpoint
app.post('/scrape', requireApiKey, async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  console.log(`[API] Scraping request for: ${url}`);

  try {
    const result = await scrapeUrl(url);
    res.json(result);
  } catch (error) {
    console.error(`[API] Error scraping ${url}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, closing browser...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`[Server] Scraping service running on port ${PORT}`);
  console.log(`[Server] API Key authentication enabled`);
  
  // Initialize browser on startup
  initBrowser().catch(console.error);
});
