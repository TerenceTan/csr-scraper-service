/**
 * Scraper module - Enhanced version with formatting preservation and mode selection
 */
import { chromium } from 'playwright-core';
import { ENV } from './_core/env';

const BROWSERLESS_API_KEY = ENV.browserlessApiKey;
const BROWSERLESS_URL = `wss://production-sfo.browserless.io?token=${BROWSERLESS_API_KEY}`;

export interface ScrapedSection {
  sectionType: string;
  sectionTitle: string | null;
  content: string;
  orderIndex: number;
}

// Define the extraction logic as a string to avoid esbuild instrumentation (ReferenceError: __name is not defined)
const EXTRACT_CONTENT_SCRIPT = `
  window.extractContent = function({ scrapingMode, livePricingData }) {
      const result = [];
      const processedTexts = new Set();
      let orderIndex = 0;

      const isVisible = (elem) => {
        if (!elem) return false;
        const style = window.getComputedStyle(elem);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };

      const getCleanText = (element) => {
        return element.innerText?.replace(/\\s+/g, ' ').trim();
      };
      
      const getFormattedText = (element) => {
          // Clone to avoid modifying DOM
          const clone = element.cloneNode(true);
          // Remove scripts/styles
          const toRemove = clone.querySelectorAll('script, style, noscript, svg');
          toRemove.forEach((el) => el.remove());
          return clone.innerHTML?.replace(/\\s+/g, ' ').trim();
      };

      const isNavigationOrFooter = (element) => {
        const tagName = element.tagName.toLowerCase();
        const testId = element.getAttribute('data-testid') || '';
        const className = typeof element.className === 'string' ? element.className : '';
        const id = element.id || '';
        
        // Footer: Only exclude main site footer
        if (tagName === 'footer') {
            if (testId === 'pui-footer' || className.includes('global-footer') || element.getAttribute('role') === 'contentinfo') {
                return true;
            }
            // Allow other footers (like card footers)
            return false;
        }
        
        if (tagName === 'nav') return true;
        
        if (tagName === 'header') {
          // Allow container-header__content (page content)
          if (className.includes('container-header__content')) return false;
          
          // Exclude main site headers
          if (testId.includes('header') || id.includes('header') || className.includes('global-header') || element.getAttribute('role') === 'banner') {
             // Double check it's not a hero section
             if (!className.includes('hero') && !className.includes('banner')) {
                 return true;
             }
          }
          
          // Exclude explicit nav headers
          if (testId.includes('nav') || className.includes('nav') || id.includes('nav')) {
            return true;
          }
          
          return false;
        }
        
        // Excluded components (removed pui-live-pricing)
        if (testId === 'pui-disclaimer-banner' || testId === 'pui-cookies' ||
            testId === 'pui-gn-btn-default' || testId === 'pui-gn-btn-text' || 
            testId === 'pui-language-selector' || testId === 'top-nav-component' ||
            testId === 'mobile-top-nav-component' || testId === 'pui-sub-navigation' || testId === 'pui-breadcrumb') {
          return true;
        }
        
        if (className.includes('global-nav-button-decor')) return true;
        
        const combinedText = (className + ' ' + id).toLowerCase();
        const navFooterPatterns = [
          'global-nav', 'top-nav', 'main-nav', 'primary-nav',
          'sidebar', 'breadcrumb',
          'cookie', 'toolbar', 'topbar', 'bottombar'
        ];
        
        return navFooterPatterns.some(pattern => combinedText.includes(pattern));
      };

      const findMainContent = () => {
        const main = document.querySelector('main');
        if (main) return main;
        const article = document.querySelector('article');
        if (article) return article;
        const content = document.querySelector('#content') || document.querySelector('.content') || document.querySelector('.main');
        if (content) return content;
        return document.body;
      };


      // Specialized handler for Live Pricing (using injected data)
      const injectLivePricingData = () => {
        console.log('Attempting to inject Live Pricing Data...');
        if (!livePricingData || livePricingData.length === 0) {
            console.log('No live pricing data to inject.');
            return;
        }
        console.log('Injecting ' + livePricingData.length + ' tabs of data.');

        livePricingData.forEach(tabData => {
            if (!tabData) return;

            // Add Tab
            const tabContent = 'Tab: ' + tabData.tabName;
            if (!processedTexts.has(tabContent)) {
                processedTexts.add(tabContent);
                result.push({
                    sectionType: 'live-pricing-tab',
                    sectionTitle: 'Live Pricing Tab',
                    content: tabContent,
                    orderIndex: orderIndex++,
                });
            }

            // Add Tables
            tabData.tables.forEach((table, index) => {
                const tableContent = '[Table] Headers: ' + table.headers + ' || Rows: ' + table.rows.join(', ');
                if (!processedTexts.has(tableContent)) {
                    processedTexts.add(tableContent);
                    result.push({
                        sectionType: 'live-pricing-table',
                        sectionTitle: 'Live Pricing Table ' + (index + 1),
                        content: tableContent,
                        orderIndex: orderIndex++,
                    });
                }
            });
        });
      };

      const traverse = (element) => {
        if (!element) return;
        
        // Handle Text Nodes directly
        if (element.nodeType === Node.TEXT_NODE) {
            const text = element.textContent?.trim();
            if (text && text.length > 3 && !processedTexts.has(text)) {
                processedTexts.add(text);
                result.push({
                    sectionType: 'text',
                    sectionTitle: null,
                    content: text,
                    orderIndex: orderIndex++,
                });
            }
            return;
        }

        if (element.nodeType !== Node.ELEMENT_NODE) return;
        
        const tagName = element.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'iframe', 'svg'].includes(tagName)) return;
        
        // Check for Ant Design accordion ITEM container BEFORE visibility check
        // This allows us to capture both header and body together
        const earlyClassName = typeof element.className === 'string' ? element.className : '';
        if (earlyClassName.includes('ant-collapse-item')) {
          // Extract header
          const headerEl = element.querySelector('.ant-collapse-header');
          const headerText = headerEl ? getCleanText(headerEl) : null;
          const headerFormatted = headerEl ? getFormattedText(headerEl) : null;
          
          // Extract body content
          const contentBox = element.querySelector('.ant-collapse-content-box') || element.querySelector('.ant-collapse-content');
          const bodyText = contentBox ? getCleanText(contentBox) : null;
          const bodyFormatted = contentBox ? getFormattedText(contentBox) : null;
          
          // Use a unique key combining header text with element index to avoid deduplication issues
          const uniqueKey = 'accordion-' + orderIndex + '-' + (headerText || '').substring(0, 50);
          
          if (headerText && headerText.length > 0 && !processedTexts.has(uniqueKey + '-header')) {
            processedTexts.add(uniqueKey + '-header');
            result.push({
              sectionType: 'accordion-header',
              sectionTitle: headerText,
              content: headerFormatted,
              orderIndex: orderIndex++,
            });
          }
          
          if (bodyText && bodyText.length > 0 && !processedTexts.has(uniqueKey + '-body')) {
            processedTexts.add(uniqueKey + '-body');
            result.push({
              sectionType: 'accordion-body',
              sectionTitle: null,
              content: bodyFormatted,
              orderIndex: orderIndex++,
            });
          }
          
          return; // Don't traverse children, we captured header and body
        }
        
        if (!isVisible(element)) return;
        
        // Check for Live Pricing Component
        const testId = element.getAttribute('data-testid') || '';
        if (testId === 'pui-live-pricing') {
            console.log('Found pui-live-pricing element during traversal.');
            injectLivePricingData();
            return; // Stop traversing this branch as we handled it
        }
        
        // Only check isNavigationOrFooter if we are in 'main' mode
        if (scrapingMode === 'main' && isNavigationOrFooter(element)) return;

        // Tables
        if (tagName === 'table') {
          const rows = element.querySelectorAll('tr');
          if (rows.length > 0) {
            const tableContent = [];
            rows.forEach((row) => {
              const cells = row.querySelectorAll('th, td');
              const cellTexts = [];
              cells.forEach((cell) => {
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
        
        // Accordion handling - detect non-Ant Design accordion patterns
        // (Ant Design accordions are handled earlier via ant-collapse-item)
        const className = typeof element.className === 'string' ? element.className : '';
        
        // Skip ant-collapse elements as they're handled above
        if (className.includes('ant-collapse-header') || className.includes('ant-collapse-content')) {
          return;
        }
        
        // Accordion header detection (Radix UI, custom implementations)
        const isAccordionHeader = className.includes('accordion-header') ||
          className.includes('accordion__header') ||
          className.includes('accordion-trigger') ||
          element.getAttribute('data-testid')?.includes('accordion') ||
          (element.getAttribute('role') === 'button' && element.closest('[data-testid*="accordion"]'));
        
        if (isAccordionHeader) {
          const text = getCleanText(element);
          const formattedText = getFormattedText(element);
          const uniqueKey = 'accordion-header-' + orderIndex + '-' + text.substring(0, 50);
          
          if (text && text.length > 0 && !processedTexts.has(uniqueKey)) {
            processedTexts.add(uniqueKey);
            result.push({
              sectionType: 'accordion-header',
              sectionTitle: text,
              content: formattedText,
              orderIndex: orderIndex++,
            });
          }
          // Don't return - continue to traverse children/siblings for body content
        }
        
        // Accordion body/content detection (non-Ant Design)
        const isAccordionBody = className.includes('accordion-body') ||
          className.includes('accordion__body') ||
          className.includes('accordion-content') ||
          className.includes('accordion__content') ||
          className.includes('accordion-panel') ||
          element.getAttribute('data-testid')?.includes('accordion-content') ||
          element.getAttribute('role') === 'region';
        
        if (isAccordionBody) {
          const text = getCleanText(element);
          const formattedText = getFormattedText(element);
          const uniqueKey = 'accordion-body-' + orderIndex + '-' + text.substring(0, 50);
          
          if (text && text.length > 0 && !processedTexts.has(uniqueKey)) {
            processedTexts.add(uniqueKey);
            result.push({
              sectionType: 'accordion-body',
              sectionTitle: null,
              content: formattedText,
              orderIndex: orderIndex++,
            });
          }
          return; // Captured body content, don't traverse children again
        }
        
        // Buttons
        if (tagName === 'button') {
          const text = getCleanText(element);
          const formattedText = getFormattedText(element);
          
          if (text && text.length > 10 && !processedTexts.has(text)) {
            processedTexts.add(text);
            result.push({
              sectionType: tagName,
              sectionTitle: null,
              content: formattedText,
              orderIndex: orderIndex++,
            });
          }
          return;
        }

        // Links (<a>) - Smart Handling
        if (tagName === 'a') {
            // Check if it contains block elements (div, p, headings, section, article)
            const hasBlockChildren = element.querySelector('div, p, h1, h2, h3, h4, h5, h6, section, article');
            
            if (hasBlockChildren) {
                // It's a complex card/container link -> Traverse children
                // We don't return here, we let it fall through to "Traverse children"
            } else {
                // It's a simple text link -> Capture it
                const text = getCleanText(element);
                const formattedText = getFormattedText(element);
                
                if (text && text.length > 0 && !processedTexts.has(text)) {
                    processedTexts.add(text);
                    result.push({
                        sectionType: 'link',
                        sectionTitle: null,
                        content: '<u>' + formattedText + '</u>',
                        orderIndex: orderIndex++,
                    });
                }
                return; // Stop traversing children for simple links
            }
        }
        
        // Traverse childNodes (handles both Elements and Text Nodes)
        if (element.childNodes) {
          for (let i = 0; i < element.childNodes.length; i++) {
            traverse(element.childNodes[i]);
          }
        }
      };

      if (scrapingMode === 'header') {
        // First check for specific Pepperstone header class
        const psHeaders = document.querySelectorAll('.ps-grid-in-header');
        if (psHeaders.length > 0) {
            psHeaders.forEach((header) => traverse(header));
        } else {
            // Fallback to standard headers
            const headers = document.querySelectorAll('header, [role="banner"], .global-header, .header');
            if (headers.length > 0) {
                headers.forEach((header) => traverse(header));
            } else {
                traverse(document.body);
            }
        }
      } else if (scrapingMode === 'footer') {
        const footers = document.querySelectorAll('footer, [role="contentinfo"], .global-footer, .footer');
        if (footers.length > 0) {
            footers.forEach((footer) => traverse(footer));
        } else {
            traverse(document.body);
        }
      } else {
        // Main Mode - Enhanced to capture Hero/Banner sections
        
        // 1. Traverse Hero/Banner sections
        const heroSelectors = ['.top-banner', '.hero', '.hero-banner', '.banner'];
        const heroElements = [];
        heroSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => heroElements.push(el));
        });
        
        heroElements.forEach(hero => traverse(hero));

        // 2. Traverse Main Content
        const mainContent = findMainContent();
        if (mainContent) {
            // Avoid re-traversing if mainContent is inside a hero (unlikely) or vice versa
            // Simple check: if mainContent is not contained in any processed hero
            const isInsideHero = heroElements.some(hero => hero.contains(mainContent));
            if (!isInsideHero) {
                traverse(mainContent);
            }
        }
      }

      return result;
  };
`;

export async function scrapeUrl(url: string, scrapingMode: "main" | "header" | "footer" = "main"): Promise<{ pageTitle: string, content: ScrapedSection[] }> {
  console.log(`Connecting to Browserless for ${url} in ${scrapingMode} mode...`);
  const browser = await chromium.connectOverCDP(BROWSERLESS_URL);
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Expand all accordions to reveal hidden content
    console.log('Expanding accordions...');
    await page.evaluate(() => {
      // Click all accordion triggers to expand them
      const accordionSelectors = [
        // Radix UI / Headless UI patterns
        '[data-state="closed"]',
        '[aria-expanded="false"]',
        // Ant Design
        '.ant-collapse-header',
        // Common patterns
        '.accordion-header',
        '.accordion__header',
        '.accordion-trigger',
        '.accordion__trigger',
        '[data-testid*="accordion"]',
        // Button-based accordions
        'button[aria-controls]',
        // Details/summary elements
        'details:not([open]) summary'
      ];
      
      accordionSelectors.forEach(selector => {
        try {
          document.querySelectorAll(selector).forEach((el) => {
            // Skip if already expanded
            if (el.getAttribute('data-state') === 'open' || 
                el.getAttribute('aria-expanded') === 'true' ||
                (el.tagName === 'DETAILS' && el.hasAttribute('open'))) {
              return;
            }
            
            // For details elements, set open attribute
            if (el.tagName === 'DETAILS') {
              el.setAttribute('open', '');
              return;
            }
            
            // Click to expand
            if (el instanceof HTMLElement) {
              el.click();
            }
          });
        } catch (e) {
          console.log('Error expanding accordion with selector:', selector, e);
        }
      });
    });
    
    // Wait for accordion animations to complete
    await page.waitForTimeout(1000);

    // Interactive Live Pricing Extraction (Only in Main Mode)
    let livePricingData: any[] = [];
    if (scrapingMode === 'main') {
      // Check if Live Pricing exists (wait for it to load)
      let hasLivePricing = false;
      try {
        await page.waitForSelector('[data-testid="pui-live-pricing"]', { timeout: 10000 });
        hasLivePricing = true;
        console.log('Live Pricing component detected.');
      } catch (e) {
        console.log('Live Pricing component not found or timed out.');
      }

      if (hasLivePricing) {
        console.log('Live Pricing component found. Starting interactive extraction...');

        // Get number of tabs
        const tabCount = await page.evaluate(() => {
          return document.querySelectorAll('[data-testid="pui-live-pricing"] button[role="tab"]').length;
        });

        console.log(`Found ${tabCount} tabs.`);

        for (let i = 0; i < tabCount; i++) {
          // Click tab
          await page.evaluate((index) => {
            const tabs = document.querySelectorAll('[data-testid="pui-live-pricing"] button[role="tab"]');
            if (tabs[index]) (tabs[index] as HTMLElement).click();
          }, i);

          // Wait for content update (simple timeout for now, could be smarter)
          await page.waitForTimeout(2000);

          // Extract data for this tab
          const tabData = await page.evaluate((index) => {
            const container = document.querySelector('[data-testid="pui-live-pricing"]');
            if (!container) return null;

            const tabs = container.querySelectorAll('button[role="tab"]');
            const currentTabName = tabs[index]?.textContent?.trim();

            const tables = container.querySelectorAll('table');
            const tablesData: any[] = [];

            tables.forEach((table, tableIndex) => {
              const headers = Array.from(table.querySelectorAll('th'))
                .map(th => th.textContent?.trim())
                .filter(text => text)
                .join(' | ');

              const rows = table.querySelectorAll('tbody tr');
              const rowData: string[] = [];
              rows.forEach(row => {
                const firstCell = row.querySelector('td:first-child');
                const lastCell = row.querySelector('td:last-child');
                let lastCellContent = '';
                if (lastCell) {
                  const button = lastCell.querySelector('button');
                  const link = lastCell.querySelector('a');
                  if (button) lastCellContent = button.outerHTML;
                  else if (link) lastCellContent = link.outerHTML;
                }
                const firstColText = firstCell ? firstCell.textContent?.trim() : null;
                if (firstColText) {
                  rowData.push(firstColText + (lastCellContent ? ' | ' + lastCellContent : ''));
                }
              });

              if (headers || rowData.length > 0) {
                tablesData.push({
                  headers,
                  rows: rowData
                });
              }
            });

            return {
              tabName: currentTabName,
              tables: tablesData
            };
          }, i);

          if (tabData) {
            livePricingData.push(tabData);
          }
        }
      }
    }

    // Inject the extraction script
    await page.addScriptTag({ content: EXTRACT_CONTENT_SCRIPT });

    console.log(`[Server] Live Pricing Data collected: ${livePricingData.length} tabs`);
    if (livePricingData.length > 0) {
      console.log(`[Server] First tab data:`, JSON.stringify(livePricingData[0], null, 2));
    }

    // Enable console logging from the page
    page.on('console', msg => console.log(`[Browser] ${msg.text()}`));

    // Execute the extraction function
    const sections = await page.evaluate(({ scrapingMode, livePricingData }: { scrapingMode: any, livePricingData: any }) => {
      // @ts-ignore
      return window.extractContent({ scrapingMode, livePricingData });
    }, { scrapingMode, livePricingData });

    const pageTitle = await page.title();
    return { pageTitle, content: sections };

  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}
