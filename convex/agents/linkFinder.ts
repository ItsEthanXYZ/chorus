// Link Finder Agent
// Discovers documentation links for a given service

import { BaseAgent } from "../lib/baseAgent";
import type { ActionCtx } from "../_generated/server";
import type { LinkFinderInput, LinkFinderOutput } from "../lib/types";
import { createLLMClient } from "../lib/llm";

/**
 * Link Finder Agent
 * Intelligently discovers documentation links for a service
 * Uses LLM to analyze sitemap and suggest relevant documentation URLs
 */
export class LinkFinderAgent extends BaseAgent<LinkFinderInput, LinkFinderOutput> {
  constructor(ctx: ActionCtx) {
    super(ctx, "link_finder");
  }

  protected async validate(input: LinkFinderInput): Promise<void> {
    if (!input.service) {
      throw new Error("Service name is required");
    }
    if (!input.baseUrl) {
      throw new Error("Base URL is required");
    }
  }

  protected async run(input: LinkFinderInput): Promise<LinkFinderOutput> {
    this.log(`Finding documentation links for ${input.service}`);

    const {
      baseUrl,
      crawlPatterns = [],
      excludePatterns = [],
      maxDepth = 2,
    } = input;

    try {
      // Step 1: Fetch sitemap if available
      const sitemapLinks = await this.fetchSitemap(baseUrl);

      // Step 2: Crawl and discover links
      const discoveredLinks = await this.discoverLinks(
        baseUrl,
        crawlPatterns,
        excludePatterns,
        maxDepth
      );

      // Step 3: Combine and deduplicate
      const allLinks = Array.from(
        new Set([...sitemapLinks, ...discoveredLinks])
      );

      // Step 4: Filter and prioritize using LLM
      const filteredLinks = await this.filterLinksWithLLM(
        allLinks,
        input.service,
        crawlPatterns
      );

      this.log(`Found ${filteredLinks.length} documentation links`);

      return {
        success: true,
        data: {
          links: filteredLinks,
          totalFound: filteredLinks.length,
        },
      };
    } catch (error: any) {
      this.log(`Error finding links: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch and parse sitemap.xml
   */
  private async fetchSitemap(baseUrl: string): Promise<string[]> {
    const sitemapUrls = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_index.xml`,
      `${baseUrl}/docs/sitemap.xml`,
    ];

    const links: string[] = [];

    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await fetch(sitemapUrl);
        if (!response.ok) continue;

        const xml = await response.text();
        const urlMatches = xml.matchAll(/<loc>(.*?)<\/loc>/g);

        for (const match of urlMatches) {
          links.push(match[1]);
        }

        this.log(`Found ${links.length} links in sitemap: ${sitemapUrl}`);
        break; // If we found a sitemap, stop looking
      } catch (error) {
        // Continue to next sitemap URL
        continue;
      }
    }

    return links;
  }

  /**
   * Discover links by crawling
   */
  private async discoverLinks(
    baseUrl: string,
    includePatterns: string[],
    excludePatterns: string[],
    maxDepth: number
  ): Promise<string[]> {
    const visited = new Set<string>();
    const links = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [
      { url: baseUrl, depth: 0 },
    ];

    // Common documentation paths to try
    const commonPaths = [
      "/docs",
      "/documentation",
      "/api",
      "/reference",
      "/guide",
      "/guides",
      "/tutorial",
      "/tutorials",
      "/getting-started",
    ];

    // Add common paths to queue
    for (const path of commonPaths) {
      queue.push({ url: `${baseUrl}${path}`, depth: 0 });
    }

    while (queue.length > 0 && links.size < 100) {
      const { url, depth } = queue.shift()!;

      if (visited.has(url) || depth > maxDepth) {
        continue;
      }

      visited.add(url);

      // Check if URL matches patterns
      if (!this.matchesPatterns(url, includePatterns, excludePatterns)) {
        continue;
      }

      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(10000),
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; DocBot/1.0)",
          },
        });

        if (!response.ok) {
          continue;
        }

        links.add(url);

        // Extract links if we haven't reached max depth
        if (depth < maxDepth) {
          const html = await response.text();
          const extractedLinks = this.extractLinks(html, baseUrl);

          for (const link of extractedLinks) {
            if (!visited.has(link) && link.startsWith(baseUrl)) {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        }
      } catch (error) {
        // Skip this URL if it fails
        continue;
      }
    }

    return Array.from(links);
  }

  /**
   * Check if URL matches include/exclude patterns
   */
  private matchesPatterns(
    url: string,
    includePatterns: string[],
    excludePatterns: string[]
  ): boolean {
    // Check exclude patterns first
    if (excludePatterns.length > 0) {
      for (const pattern of excludePatterns) {
        if (url.includes(pattern)) {
          return false;
        }
      }
    }

    // If no include patterns, accept the URL
    if (includePatterns.length === 0) {
      return true;
    }

    // Check include patterns
    for (const pattern of includePatterns) {
      if (url.includes(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract links from HTML
   */
  private extractLinks(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const hrefRegex = /href=["']([^"']+)["']/g;
    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
      try {
        const url = new URL(match[1], baseUrl);
        if (url.protocol === "http:" || url.protocol === "https:") {
          links.push(url.toString());
        }
      } catch {
        // Invalid URL, skip
      }
    }

    return links;
  }

  /**
   * Use LLM to filter and prioritize links
   */
  private async filterLinksWithLLM(
    links: string[],
    service: string,
    crawlPatterns: string[]
  ): Promise<string[]> {
    if (links.length === 0) {
      return [];
    }

    // If we have too many links, use LLM to filter
    if (links.length > 50) {
      this.log(`Using LLM to filter ${links.length} links`);

      const llm = createLLMClient({ model: "gpt-4o-mini", temperature: 0.3 });

      const prompt = `You are analyzing documentation URLs for the ${service} service.

Here are the discovered URLs (showing first 100):
${links.slice(0, 100).map((link, i) => `${i + 1}. ${link}`).join("\n")}

${crawlPatterns.length > 0 ? `Priority patterns: ${crawlPatterns.join(", ")}` : ""}

Task: Filter these URLs to include only:
1. Official documentation pages
2. API references
3. Guides and tutorials
4. Getting started pages

Exclude:
- Blog posts
- Marketing pages
- Non-documentation content
- Changelog pages (unless specifically about API changes)

Return a JSON array of the filtered URLs (maximum 50 most important ones), prioritized by relevance.
Format: {"urls": ["url1", "url2", ...]}`;

      try {
        const result = await llm.generateJSON<{ urls: string[] }>([
          { role: "user", content: prompt },
        ]);

        return result.urls || links.slice(0, 50);
      } catch (error) {
        this.log(`LLM filtering failed, using all links: ${error}`);
        return links.slice(0, 50);
      }
    }

    return links;
  }
}
