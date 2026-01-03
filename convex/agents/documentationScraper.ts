// Documentation Scraper Agent
// Scrapes documentation content from URLs using Firecrawl

import { BaseAgent } from "../lib/baseAgent";
import type { ActionCtx } from "../_generated/server";
import type { DocumentationScraperInput, DocumentationScraperOutput } from "../lib/types";
import { createScraperClient } from "../lib/scraper";

/**
 * Documentation Scraper Agent
 * Scrapes documentation content from provided URLs
 * Uses Firecrawl for intelligent content extraction
 */
export class DocumentationScraperAgent extends BaseAgent<
  DocumentationScraperInput,
  DocumentationScraperOutput
> {
  constructor(ctx: ActionCtx) {
    super(ctx, "documentation_scraper");
  }

  protected async validate(input: DocumentationScraperInput): Promise<void> {
    if (!input.urls || input.urls.length === 0) {
      throw new Error("At least one URL is required");
    }
    if (!input.service) {
      throw new Error("Service name is required");
    }
    if (!input.library) {
      throw new Error("Library name is required");
    }
    if (!input.version) {
      throw new Error("Version is required");
    }
  }

  protected async run(input: DocumentationScraperInput): Promise<DocumentationScraperOutput> {
    this.log(`Scraping ${input.urls.length} URLs for ${input.service}`);

    try {
      // Create scraper client (will use Firecrawl if API key is available)
      const scraper = createScraperClient();

      // Scrape URLs in batches to avoid overwhelming the service
      const batchSize = 10;
      const documents: Array<{
        url: string;
        content: string;
        title?: string;
        markdown?: string;
      }> = [];

      for (let i = 0; i < input.urls.length; i += batchSize) {
        const batch = input.urls.slice(i, i + batchSize);
        this.log(`Scraping batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(input.urls.length / batchSize)}`);

        const results = await scraper.scrapeUrls(batch, {
          formats: ["markdown"],
          onlyMainContent: true,
          timeout: 30000,
        });

        for (const result of results) {
          if (!result.error && result.content) {
            documents.push({
              url: result.url,
              content: result.content,
              title: result.title,
              markdown: result.markdown,
            });
          } else {
            this.log(`Failed to scrape ${result.url}: ${result.error}`);
          }
        }

        // Add a small delay between batches
        if (i + batchSize < input.urls.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      this.log(`Successfully scraped ${documents.length}/${input.urls.length} URLs`);

      return {
        success: true,
        data: {
          documents,
          totalScraped: documents.length,
        },
      };
    } catch (error: any) {
      this.log(`Error scraping documentation: ${error.message}`);
      throw error;
    }
  }
}
