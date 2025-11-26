/**
 * Scraper module - Enhanced version with formatting preservation and mode selection
 */
import { chromium } from 'playwright-core';
import { ENV } from './_core/env';

const BROWSERLESS_API_KEY = ENV.browserlessApiKey;

function isBrowserlessConfigured(): boolean {
  return Boolean(BROWSERLESS_API_KEY);
}

function getBrowserlessEndpoint(): string {
  return `wss://production-sfo.browserless.io?token=${BROWSERLESS_API_KEY}`;
}

/**
 * Extract visible text content from a page - now with formatting preservation and mode selection
 */
async function extractContent(page: any, scrapingMode: string) {
  const extractionScript = `
    (() => {
      const scrapingMode = '${scrapingMode}';
      const result = [];
      let orderIndex = 0;
      const processedTexts = new Set();

      const isVisible = (element) => {
        const isInAccordion = element.closest('.ant-collapse-content, [role="region"]');
        if (isInAccordion) return true;
        
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      };

      const getCleanText = (element) => {
        return element.textContent?.trim() || '';
      };
      
      const getFormattedText = (element) => {
        const clone = element.cloneNode(true);
        clone.querySelectorAll('script, style').forEach(el => el.remove());
        
        let html = clone.innerHTML || '';
        
        // Convert HTML entities to spaces
        html = html.replace(/&nbsp;/g, ' ');
        html = html.replace(/&amp;/g, '&');
        html = html.replace(/&lt;/g, '<');
        html = html.replace(/&gt;/g, '>');
        html = html.replace(/&quot;/g, '"');
        
        // Convert block elements to newlines
        html = html.replace(/<br\\s*\\/?>/gi, '\\n');
        html = html.replace(/<\\/(?:div|p|li|h[1-6])>/gi, '\\n');
        
        // Remove italic tags completely
        html = html.replace(/<\\/?(?:em|i)>/gi, '');
        
        // Remove all tags except strong, b, u, mark
        const keepTags = 'strong|b|u|mark';
        html = html.replace(new RegExp('<(?!\\/?' + '(' + keepTags + '))[^>]+>', 'gi'), '');
        html = html.replace(new RegExp('<\\/(?!' + '(' + keepTags + '))[^>]+>', 'gi'), '');
        
        html = html.replace(/\\n\\s*\\n/g, '\\n').trim();
        return html || element.textContent?.trim() || '';
      };

      const isNavigationOrFooter = (element) => {
        const tagName = element.tagName.toLowerCase();
        
        if (['nav', 'footer'].includes(tagName)) return true;
        
        if (tagName === 'header') {
          const testId = element.getAttribute('data-testid') || '';
          const className = typeof element.className === 'string' ? element.className : '';
          const id = element.id || '';
          
          // Allow container-header__content (page content), block navigation headers
          if (className.includes('container-header__content')) return false;
          
          if (testId.includes('nav') || className.includes('nav') || id.includes('nav')) {
            return true;
          }
          // Only block if it's a top-level header (not content header)
          if (testId.includes('header') || id.includes('header') || className.includes('global-header')) {
            return true;
          }
          return false;
        }
        
        const testId = element.getAttribute('data-testid') || '';
        if (testId === 'pui-disclaimer-banner' || testId === 'pui-live-pricing' || testId === 'pui-cookies' ||
            testId === 'pui-gn-btn-default' || testId === 'pui-gn-btn-text' || 
            testId === 'pui-language-selector' || testId === 'top-nav-component' ||
            testId === 'mobile-top-nav-component' || testId === 'pui-sub-navigation' || testId === 'pui-breadcrumb') {
          return true;
        }
        
        const className = typeof element.className === 'string' ? element.className : '';
        const id = element.id || '';
        
        if (className.includes('global-nav-button-decor')) return true;
        
        const combinedText = (className + ' ' + id).toLowerCase();
        const navFooterPatterns = [
          'global-nav', 'top-nav', 'main-nav', 'primary-nav',
          'footer', 'sidebar', 'breadcrumb',
          'cookie', 'toolbar', 'topbar', 'bottombar'
        ];
        
        return navFooterPatterns.some(pattern => combinedText.includes(pattern));
      };

      const findMainContent = () => {
        const mainSelectors = [
          'main', 'article', '[role="main"]',
          '.main-content', '.content', '#content', '#main'
        ];
        
        for (const selector of mainSelectors) {
          const element = document.querySelector(selector);
          if (element) return element;
        }
        return document.body;
      };

      const traverse = (element) => {
        if (!element || !element.tagName) return;
        
        const tagName = element.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'iframe', 'svg'].includes(tagName)) return;
        if (!isVisible(element)) return;
        
        // Only check isNavigationOrFooter if we are in 'main' mode
        if (scrapingMode === 'main' && isNavigationOrFooter(element)) return;

        // Tables
        if (tagName === 'table') {
          const rows = element.querySelectorAll('tr');
          if (rows.length > 0) {
            const tableContent = [];
            rows.forEach(row => {
              const cells = row.querySelectorAll('th, td');
              const cellTexts = [];
              cells.forEach(cell => {
                const cellText = getCleanText(cell);
                if (cellText) cellTexts.push(cellText);
              });
              if (cellTexts.length > 0) {
                tableContent.push(cellTexts.join(' | '));
              }
            });
            if (tableContent.length > 0) {
              const fullTableText = tableContent.join(' || ');
              if (!processedTexts.has(fullTableText)) {
                processedTexts.add(fullTableText);
                result.push({
                  sectionType: 'table',
                  sectionTitle: null,
                  content: fullTableText,
                  orderIndex: orderIndex++,
                });
              }
            }
          }
          return;
        }

        // Regular elements
        const captureElements = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'header'];
        
        if (captureElements.includes(tagName)) {
          const text = getCleanText(element);
          const formattedText = getFormattedText(element);
          
          if (text && text.length > 0 && !processedTexts.has(text)) {
            processedTexts.add(text);
            result.push({
              sectionType: tagName === 'header' ? 'section-header' : tagName,
              sectionTitle: tagName.startsWith('h') || tagName === 'header' ? text : null,
              content: formattedText,
              orderIndex: orderIndex++,
            });
          }
          return;
        }
        
        // Accordion headers
        const className = typeof element.className === 'string' ? element.className : '';
        if (className.includes('ant-collapse-header')) {
          const text = getCleanText(element);
          const formattedText = getFormattedText(element);
          
          if (text && text.length > 0 && !processedTexts.has(text)) {
            processedTexts.add(text);
            result.push({
              sectionType: 'accordion-header',
              sectionTitle: text,
              content: formattedText,
              orderIndex: orderIndex++,
            });
          }
          return;
        }
        
        // Buttons and links
        if (['button', 'a'].includes(tagName)) {
          const text = getCleanText(element);
          const formattedText = getFormattedText(element);
          
          if (text && text.length > 10 && !processedTexts.has(text)) {
            processedTexts.add(text);
            result.push({
              sectionType: tagName,
              sectionTitle: null,
              content: tagName === 'a' ? '<u>' + formattedText + '</u>' : formattedText,
              orderIndex: orderIndex++,
            });
          }
          return;
        }
        
        // Direct div text
        if (tagName === 'div') {
          let directText = '';
          let directHTML = '';
          
          for (const node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
              directText += node.textContent?.trim() || '';
            } else if (node.nodeType === Node.ELEMENT_NODE && ['STRONG', 'B', 'EM', 'I', 'U', 'MARK'].includes(node.tagName)) {
              directHTML += node.outerHTML;
              directText += node.textContent?.trim() || '';
            }
          }
          
          if (directText && directText.length > 10 && !processedTexts.has(directText)) {
            processedTexts.add(directText);
            result.push({
              sectionType: 'div-text',
              sectionTitle: null,
              content: directHTML || directText,
              orderIndex: orderIndex++,
            });
          }
        }

        // Traverse children
        if (element.children) {
          for (let i = 0; i < element.children.length; i++) {
            traverse(element.children[i]);
          }
        }
      };

      if (scrapingMode === 'header') {
        // First check for specific Pepperstone header class
        const psHeaders = document.querySelectorAll('.ps-grid-in-header');
        if (psHeaders.length > 0) {
            psHeaders.forEach(header => traverse(header));
        } else {
            // Fallback to standard headers
            const headers = document.querySelectorAll('header, [role="banner"], .global-header, .header');
            if (headers.length > 0) {
                headers.forEach(header => traverse(header));
            } else {
                traverse(document.body);
            }
        }
      } else if (scrapingMode === 'footer') {
        const footers = document.querySelectorAll('footer, [role="contentinfo"], .global-footer, .footer');
        if (footers.length > 0) {
            footers.forEach(footer => traverse(footer));
        } else {
            traverse(document.body);
        }
      } else {
        const mainContent = findMainContent();
        if (mainContent) traverse(mainContent);
      }

      return result;
    })()
  `;

  return await page.evaluate(extractionScript);
}

export async function scrapeUrl(
  url: string,
  scrapingMode: "main" | "header" | "footer" = "main"
): Promise<{
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

  console.log('[Scraper] Connecting to Browserless...');
  const endpoint = getBrowserlessEndpoint();
  console.log('[Scraper] Endpoint:', endpoint.replace(BROWSERLESS_API_KEY!, '***'));

  const browser = await chromium.connectOverCDP(endpoint);
  console.log('[Scraper] Connected successfully');

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`[Scraper] Navigating to ${url} with mode ${scrapingMode}...`);
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    console.log('[Scraper] Page loaded');

    await page.waitForTimeout(2000);

    const pageTitle = await page.title();
    console.log(`[Scraper] Page title: ${pageTitle}`);

    console.log('[Scraper] Extracting content...');
    const rawContent = await extractContent(page, scrapingMode);
    console.log(`[Scraper] Extracted ${rawContent.length} sections`);

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
