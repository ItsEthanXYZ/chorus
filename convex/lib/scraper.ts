// Web scraping utilities
// Provides interface for Firecrawl and fallback scraping methods

/**
 * Scraping result from a single URL
 */
export interface ScrapeResult {
  url: string;
  content: string;
  markdown?: string;
  title?: string;
  metadata?: {
    description?: string;
    keywords?: string[];
    author?: string;
    publishedDate?: string;
    [key: string]: any;
  };
  error?: string;
}

/**
 * Options for scraping
 */
export interface ScrapeOptions {
  formats?: ("markdown" | "html" | "text")[];
  waitFor?: number;
  timeout?: number;
  headers?: Record<string, string>;
  onlyMainContent?: boolean;
}

/**
 * Firecrawl client interface
 * When @mendable/firecrawl-js is available, this will use the official SDK
 * For now, provides a fallback implementation using fetch
 */
export class FirecrawlClient {
  private apiKey?: string;
  private baseUrl: string = "https://api.firecrawl.dev/v0";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FIRECRAWL_API_KEY;
  }

  /**
   * Scrape a single URL
   */
  async scrapeUrl(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
    // If Firecrawl API key is available, use the API
    if (this.apiKey) {
      return this.scrapeWithFirecrawl(url, options);
    }

    // Otherwise, fall back to basic fetch scraping
    return this.scrapeWithFetch(url, options);
  }

  /**
   * Scrape multiple URLs in batch
   */
  async scrapeUrls(
    urls: string[],
    options: ScrapeOptions = {}
  ): Promise<ScrapeResult[]> {
    const results = await Promise.allSettled(
      urls.map((url) => this.scrapeUrl(url, options))
    );

    return results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        return {
          url: urls[index],
          content: "",
          error: result.reason?.message || "Failed to scrape URL",
        };
      }
    });
  }

  /**
   * Crawl a website starting from a base URL
   */
  async crawl(
    baseUrl: string,
    options: {
      limit?: number;
      includePatterns?: string[];
      excludePatterns?: string[];
      maxDepth?: number;
    } = {}
  ): Promise<ScrapeResult[]> {
    // If Firecrawl API key is available, use the API
    if (this.apiKey) {
      return this.crawlWithFirecrawl(baseUrl, options);
    }

    // Otherwise, fall back to basic crawling
    return this.crawlWithFetch(baseUrl, options);
  }

  /**
   * Scrape using Firecrawl API
   */
  private async scrapeWithFirecrawl(
    url: string,
    options: ScrapeOptions
  ): Promise<ScrapeResult> {
    try {
      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url,
          formats: options.formats || ["markdown"],
          onlyMainContent: options.onlyMainContent ?? true,
          waitFor: options.waitFor,
          timeout: options.timeout,
        }),
      });

      if (!response.ok) {
        throw new Error(`Firecrawl API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        url,
        content: data.markdown || data.html || data.text || "",
        markdown: data.markdown,
        title: data.metadata?.title,
        metadata: data.metadata,
      };
    } catch (error) {
      console.error(`Firecrawl scraping failed for ${url}:`, error);
      // Fall back to fetch scraping
      return this.scrapeWithFetch(url, options);
    }
  }

  /**
   * Crawl using Firecrawl API
   */
  private async crawlWithFirecrawl(
    baseUrl: string,
    options: {
      limit?: number;
      includePatterns?: string[];
      excludePatterns?: string[];
      maxDepth?: number;
    }
  ): Promise<ScrapeResult[]> {
    try {
      const response = await fetch(`${this.baseUrl}/crawl`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url: baseUrl,
          limit: options.limit || 100,
          scrapeOptions: {
            formats: ["markdown"],
            onlyMainContent: true,
          },
          excludePaths: options.excludePatterns,
          includePaths: options.includePatterns,
          maxDepth: options.maxDepth,
        }),
      });

      if (!response.ok) {
        throw new Error(`Firecrawl crawl API error: ${response.statusText}`);
      }

      const data = await response.json();
      const jobId = data.jobId;

      // Poll for results
      return this.pollCrawlJob(jobId);
    } catch (error) {
      console.error(`Firecrawl crawling failed for ${baseUrl}:`, error);
      // Fall back to basic crawling
      return this.crawlWithFetch(baseUrl, options);
    }
  }

  /**
   * Poll Firecrawl crawl job for results
   */
  private async pollCrawlJob(jobId: string, maxAttempts = 30): Promise<ScrapeResult[]> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(`${this.baseUrl}/crawl/status/${jobId}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      const data = await response.json();

      if (data.status === "completed") {
        return (data.data || []).map((item: any) => ({
          url: item.url,
          content: item.markdown || item.html || item.text || "",
          markdown: item.markdown,
          title: item.metadata?.title,
          metadata: item.metadata,
        }));
      }

      if (data.status === "failed") {
        throw new Error("Crawl job failed");
      }

      // Wait before next poll (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, Math.min(2000 * (i + 1), 10000)));
    }

    throw new Error("Crawl job timeout");
  }

  /**
   * Basic scraping using fetch (fallback)
   */
  private async scrapeWithFetch(
    url: string,
    options: ScrapeOptions
  ): Promise<ScrapeResult> {
    try {
      const response = await fetch(url, {
        headers: options.headers || {
          "User-Agent": "Mozilla/5.0 (compatible; DocBot/1.0)",
        },
        signal: AbortSignal.timeout(options.timeout || 30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Basic HTML to text conversion
      const content = this.htmlToText(html);
      const title = this.extractTitle(html);

      return {
        url,
        content,
        title,
        markdown: content, // Basic conversion, not true markdown
      };
    } catch (error: any) {
      return {
        url,
        content: "",
        error: error.message || "Failed to fetch URL",
      };
    }
  }

  /**
   * Basic crawling using fetch (fallback)
   */
  private async crawlWithFetch(
    baseUrl: string,
    options: {
      limit?: number;
      includePatterns?: string[];
      excludePatterns?: string[];
      maxDepth?: number;
    }
  ): Promise<ScrapeResult[]> {
    const visited = new Set<string>();
    const results: ScrapeResult[] = [];
    const queue: Array<{ url: string; depth: number }> = [{ url: baseUrl, depth: 0 }];
    const limit = options.limit || 100;
    const maxDepth = options.maxDepth || 2;

    while (queue.length > 0 && results.length < limit) {
      const { url, depth } = queue.shift()!;

      if (visited.has(url) || depth > maxDepth) {
        continue;
      }

      visited.add(url);

      // Check patterns
      if (options.excludePatterns?.some((pattern) => url.includes(pattern))) {
        continue;
      }

      if (
        options.includePatterns &&
        !options.includePatterns.some((pattern) => url.includes(pattern))
      ) {
        continue;
      }

      const result = await this.scrapeWithFetch(url, {});
      if (!result.error) {
        results.push(result);

        // Extract links for further crawling (basic implementation)
        if (depth < maxDepth) {
          const links = this.extractLinks(result.content, baseUrl);
          links.forEach((link) => {
            if (!visited.has(link) && link.startsWith(baseUrl)) {
              queue.push({ url: link, depth: depth + 1 });
            }
          });
        }
      }
    }

    return results;
  }

  /**
   * Convert HTML to plain text (basic implementation)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Extract title from HTML
   */
  private extractTitle(html: string): string | undefined {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : undefined;
  }

  /**
   * Extract links from HTML content (basic implementation)
   */
  private extractLinks(content: string, baseUrl: string): string[] {
    // This is a very basic implementation
    // In production, you'd want to use a proper HTML parser
    const links: string[] = [];
    const regex = /href=["']([^"']+)["']/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      try {
        const url = new URL(match[1], baseUrl);
        links.push(url.toString());
      } catch {
        // Invalid URL, skip
      }
    }

    return links;
  }
}

/**
 * Create a new Firecrawl client
 */
export function createScraperClient(apiKey?: string): FirecrawlClient {
  return new FirecrawlClient(apiKey);
}
