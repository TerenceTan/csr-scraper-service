/**
 * Scraper module that calls the remote scraping microservice
 */

const SCRAPING_SERVICE_URL = process.env.SCRAPING_SERVICE_URL || '';
const SCRAPING_SERVICE_API_KEY = process.env.SCRAPING_SERVICE_API_KEY || '';

/**
 * Check if remote scraping service is configured
 */
function isRemoteServiceConfigured(): boolean {
  return Boolean(SCRAPING_SERVICE_URL && SCRAPING_SERVICE_API_KEY);
}

/**
 * Scrape a single URL using the remote scraping service
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
  if (!isRemoteServiceConfigured()) {
    throw new Error(
      'Scraping service not configured. Please set SCRAPING_SERVICE_URL and SCRAPING_SERVICE_API_KEY environment variables.'
    );
  }

  try {
    const response = await fetch(`${SCRAPING_SERVICE_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SCRAPING_SERVICE_API_KEY,
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`Scraping service returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Scraping failed');
    }

    return {
      pageTitle: result.pageTitle,
      content: result.content,
    };
  } catch (error) {
    console.error(`[Scraper] Error scraping ${url}:`, error);
    throw error;
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
