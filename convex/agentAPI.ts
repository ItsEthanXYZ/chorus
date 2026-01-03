// Agent API endpoints
// Public-facing API for interacting with the multi-LLM agent system

import { action, query } from "./_generated/server";
import { v } from "convex/values";

// Import all agents
import { LinkFinderAgent } from "./agents/linkFinder";
import { DocumentationScraperAgent } from "./agents/documentationScraper";
import { IngestionAgent } from "./agents/ingestion";
import { SearchAgent } from "./agents/search";
import { RelevanceFilterAgent } from "./agents/relevanceFilter";
import { BestPracticesCheckerAgent } from "./agents/bestPracticesChecker";
import { VersionCheckerAgent } from "./agents/versionChecker";
import { UpdateOrchestratorAgent } from "./agents/updateOrchestrator";

/**
 * Search documentation with intelligent filtering
 * Main entry point for documentation queries
 */
export const searchDocumentation = action({
  args: {
    query: v.string(),
    services: v.optional(v.array(v.string())),
    libraries: v.optional(v.array(v.string())),
    versions: v.optional(v.array(v.string())),
    categories: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
    filterRelevance: v.optional(v.boolean()),
    relevanceThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Step 1: Perform semantic search
    const searchAgent = new SearchAgent(ctx);
    const searchResults = await searchAgent.execute({
      query: args.query,
      services: args.services || [],
      libraries: args.libraries || [],
      versions: args.versions || [],
      categories: args.categories || [],
      limit: args.limit || 20,
    });

    if (!searchResults.success || !searchResults.data) {
      return searchResults;
    }

    // Step 2: Optionally filter by relevance using LLM
    if (args.filterRelevance && searchResults.data.results.length > 0) {
      const filterAgent = new RelevanceFilterAgent(ctx);
      const filterResults = await filterAgent.execute({
        query: args.query,
        results: searchResults.data.results,
        threshold: args.relevanceThreshold || 7.0,
      });

      if (filterResults.success && filterResults.data) {
        return {
          success: true,
          data: {
            results: filterResults.data.filteredResults,
            totalResults: filterResults.data.filteredResults.length,
            filteredOut: filterResults.data.removedCount,
          },
        };
      }
    }

    return searchResults;
  },
});

/**
 * Get best practices for a specific query
 */
export const getBestPractices = action({
  args: {
    query: v.string(),
    service: v.string(),
    context: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const agent = new BestPracticesCheckerAgent(ctx);
    return await agent.execute({
      query: args.query,
      service: args.service,
      context: args.context || [],
    });
  },
});

/**
 * Check version and update if needed
 */
export const checkAndUpdateService = action({
  args: {
    service: v.string(),
    autoUpdate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // First, check the version
    const versionChecker = new VersionCheckerAgent(ctx);
    const versionResult = await versionChecker.execute({
      service: args.service,
    });

    if (!versionResult.success || !versionResult.data) {
      return versionResult;
    }

    // If auto-update is enabled and update is needed, trigger update
    if (args.autoUpdate && versionResult.data.needsUpdate) {
      const updateOrchestrator = new UpdateOrchestratorAgent(ctx);
      return await updateOrchestrator.execute({
        service: args.service,
        forceUpdate: false,
      });
    }

    return versionResult;
  },
});

/**
 * Force update documentation for a service
 */
export const updateServiceDocumentation = action({
  args: {
    service: v.string(),
  },
  handler: async (ctx, args) => {
    const agent = new UpdateOrchestratorAgent(ctx);
    return await agent.execute({
      service: args.service,
      forceUpdate: true,
    });
  },
});

/**
 * Manually ingest documentation from URLs
 */
export const ingestDocumentation = action({
  args: {
    urls: v.array(v.string()),
    service: v.string(),
    library: v.string(),
    version: v.string(),
    category: v.string(),
    chunkSize: v.optional(v.number()),
    chunkOverlap: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Step 1: Scrape the URLs
    const scraper = new DocumentationScraperAgent(ctx);
    const scrapeResults = await scraper.execute({
      urls: args.urls,
      service: args.service,
      library: args.library,
      version: args.version,
    });

    if (!scrapeResults.success || !scrapeResults.data) {
      return scrapeResults;
    }

    // Step 2: Ingest the scraped content
    const ingestion = new IngestionAgent(ctx);
    return await ingestion.execute({
      documents: scrapeResults.data.documents,
      service: args.service,
      library: args.library,
      version: args.version,
      category: args.category,
      chunkSize: args.chunkSize || 1000,
      chunkOverlap: args.chunkOverlap || 200,
    });
  },
});

/**
 * Find documentation links for a service
 */
export const findDocumentationLinks = action({
  args: {
    service: v.string(),
    baseUrl: v.string(),
    crawlPatterns: v.optional(v.array(v.string())),
    excludePatterns: v.optional(v.array(v.string())),
    maxDepth: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const agent = new LinkFinderAgent(ctx);
    return await agent.execute({
      service: args.service,
      baseUrl: args.baseUrl,
      crawlPatterns: args.crawlPatterns || [],
      excludePatterns: args.excludePatterns || [],
      maxDepth: args.maxDepth || 2,
    });
  },
});

/**
 * Get agent execution logs
 */
export const getAgentLogs = query({
  args: {
    agentType: v.optional(v.string()),
    service: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("agentLogs");

    if (args.agentType) {
      query = query.withIndex("by_agent_type", (q) =>
        q.eq("agentType", args.agentType)
      );
    } else if (args.service) {
      query = query.withIndex("by_service", (q) => q.eq("service", args.service));
    } else if (args.status) {
      query = query.withIndex("by_status", (q) => q.eq("status", args.status));
    } else {
      query = query.withIndex("by_start_time");
    }

    const logs = await query.order("desc").take(args.limit || 100);

    return logs;
  },
});

/**
 * Get available services with their documentation counts
 */
export const getAvailableServices = query({
  handler: async (ctx) => {
    const services = await ctx.db.query("services").collect();

    const servicesWithStats = await Promise.all(
      services.map(async (service) => {
        const documentCount = await ctx.db
          .query("documents")
          .withIndex("by_service", (q) => q.eq("service", service.name))
          .collect()
          .then((docs) => docs.length);

        return {
          ...service,
          documentCount,
        };
      })
    );

    return servicesWithStats;
  },
});

/**
 * Advanced search with automatic best practices extraction
 */
export const searchWithBestPractices = action({
  args: {
    query: v.string(),
    service: v.string(),
    includeVersions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Parallel execution of search and best practices
    const [searchResults, bestPractices] = await Promise.all([
      // Search for relevant documentation
      (async () => {
        const searchAgent = new SearchAgent(ctx);
        const results = await searchAgent.execute({
          query: args.query,
          services: [args.service],
          versions: args.includeVersions || [],
          limit: 10,
        });

        // Filter for relevance
        if (results.success && results.data) {
          const filterAgent = new RelevanceFilterAgent(ctx);
          return await filterAgent.execute({
            query: args.query,
            results: results.data.results,
            threshold: 7.0,
          });
        }

        return results;
      })(),

      // Extract best practices
      (async () => {
        const bpAgent = new BestPracticesCheckerAgent(ctx);
        return await bpAgent.execute({
          query: args.query,
          service: args.service,
        });
      })(),
    ]);

    return {
      success: true,
      data: {
        documentation: searchResults.data,
        bestPractices: bestPractices.data,
      },
    };
  },
});
