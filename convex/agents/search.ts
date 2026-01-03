// Search Agent
// Performs semantic search across documentation with filtering

import { BaseAgent } from "../lib/baseAgent";
import type { ActionCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import type { SearchAgentInput, SearchAgentOutput } from "../lib/types";
import { embedQuery } from "../lib/embeddings";

/**
 * Search Agent
 * Performs semantic search across documentation
 * Supports filtering by service, library, version, and category
 */
export class SearchAgent extends BaseAgent<SearchAgentInput, SearchAgentOutput> {
  constructor(ctx: ActionCtx) {
    super(ctx, "search");
  }

  protected async validate(input: SearchAgentInput): Promise<void> {
    if (!input.query) {
      throw new Error("Search query is required");
    }
  }

  protected async run(input: SearchAgentInput): Promise<SearchAgentOutput> {
    this.log(`Searching for: "${input.query}"`);

    try {
      const {
        query,
        services = [],
        libraries = [],
        versions = [],
        categories = [],
        limit = 20,
      } = input;

      // Step 1: Generate embedding for the query
      const queryEmbedding = await embedQuery(query);

      // Step 2: Build filter based on input parameters
      const filter = this.buildFilter(services, libraries, versions, categories);

      // Step 3: Perform vector search
      const results = await this.ctx.runQuery(async (ctx) => {
        const searchResults = await ctx.db
          .query("documents")
          .withSearchIndex("byEmbedding", (q) => {
            let searchQuery = q.similar("embedding", queryEmbedding, limit * 2);

            // Apply filters
            if (filter.service) {
              searchQuery = searchQuery.filter((q) =>
                q.eq("service", filter.service)
              );
            }
            if (filter.library) {
              searchQuery = searchQuery.filter((q) =>
                q.eq("library", filter.library)
              );
            }
            if (filter.version) {
              searchQuery = searchQuery.filter((q) =>
                q.eq("version", filter.version)
              );
            }
            if (filter.category) {
              searchQuery = searchQuery.filter((q) =>
                q.eq("category", filter.category)
              );
            }

            return searchQuery;
          })
          .collect();

        return searchResults;
      });

      // Step 4: Post-process and filter results
      const processedResults = this.postProcessResults(
        results,
        services,
        libraries,
        versions,
        categories
      );

      // Limit to requested number
      const finalResults = processedResults.slice(0, limit);

      this.log(`Found ${finalResults.length} results`);

      return {
        success: true,
        data: {
          results: finalResults,
          totalResults: finalResults.length,
        },
      };
    } catch (error: any) {
      this.log(`Error during search: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build filter object for vector search
   * If multiple values provided for a filter, use the first one
   * (Vector search only supports single value filters)
   */
  private buildFilter(
    services: string[],
    libraries: string[],
    versions: string[],
    categories: string[]
  ): {
    service?: string;
    library?: string;
    version?: string;
    category?: string;
  } {
    return {
      service: services.length > 0 ? services[0] : undefined,
      library: libraries.length > 0 ? libraries[0] : undefined,
      version: versions.length > 0 ? versions[0] : undefined,
      category: categories.length > 0 ? categories[0] : undefined,
    };
  }

  /**
   * Post-process results to filter by multiple values
   * (Since vector search only supports single value filters)
   */
  private postProcessResults(
    results: Array<Doc<"documents"> & { _score: number }>,
    services: string[],
    libraries: string[],
    versions: string[],
    categories: string[]
  ): Array<Doc<"documents"> & { _score: number }> {
    return results.filter((result) => {
      // Filter by services
      if (services.length > 0 && !services.includes(result.service)) {
        return false;
      }

      // Filter by libraries
      if (libraries.length > 0 && !libraries.includes(result.library)) {
        return false;
      }

      // Filter by versions
      if (versions.length > 0 && !versions.includes(result.version)) {
        return false;
      }

      // Filter by categories
      if (categories.length > 0 && !categories.includes(result.category)) {
        return false;
      }

      return true;
    });
  }
}
