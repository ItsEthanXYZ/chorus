import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Documentation chunks with embeddings for semantic search
  documents: defineTable({
    embedding: v.array(v.number()),
    text: v.string(),
    // Structured metadata for better filtering and organization
    service: v.string(), // e.g., "convex", "langchain", "openai"
    library: v.string(), // Full library/package name
    version: v.string(), // Semantic version (e.g., "1.2.3")
    category: v.string(), // e.g., "api-reference", "guide", "tutorial"
    sourceUrl: v.string(), // Original documentation URL
    title: v.optional(v.string()), // Document/page title
    chunkIndex: v.number(), // Chunk number for ordered reconstruction
    lastUpdated: v.number(), // Timestamp of last update
    // Additional flexible metadata
    metadata: v.optional(v.any()),
  })
    .vectorIndex("byEmbedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: [
        "service",
        "library",
        "version",
        "category",
        "chunkIndex",
      ],
    })
    .index("by_service", ["service"])
    .index("by_library", ["library"])
    .index("by_service_and_version", ["service", "version"])
    .index("by_library_and_version", ["library", "version"]),

  // Tracks available services and their versions
  services: defineTable({
    name: v.string(), // Service identifier (e.g., "convex", "langchain")
    displayName: v.string(), // Human-readable name
    currentVersion: v.string(), // Latest known version
    libraryName: v.string(), // NPM package or library name
    docsBaseUrl: v.string(), // Base URL for documentation
    lastChecked: v.number(), // Last time version was checked
    lastUpdated: v.number(), // Last time docs were updated
    // Configuration for how to find and parse docs
    config: v.object({
      crawlPatterns: v.array(v.string()), // URL patterns to crawl
      excludePatterns: v.optional(v.array(v.string())), // Patterns to exclude
      versionCheckUrl: v.optional(v.string()), // Where to check for version
      versionCheckMethod: v.optional(v.string()), // "npm", "github", "scrape", etc.
    }),
  })
    .index("by_name", ["name"])
    .index("by_last_checked", ["lastChecked"]),

  // Agent execution logs for debugging and monitoring
  agentLogs: defineTable({
    agentType: v.string(), // Type of agent (e.g., "link_finder", "scraper")
    service: v.optional(v.string()), // Related service if applicable
    status: v.string(), // "running", "completed", "failed"
    startTime: v.number(),
    endTime: v.optional(v.number()),
    input: v.any(), // Agent input parameters
    output: v.optional(v.any()), // Agent output/results
    error: v.optional(v.string()), // Error message if failed
    metadata: v.optional(v.any()), // Additional tracking data
  })
    .index("by_agent_type", ["agentType"])
    .index("by_service", ["service"])
    .index("by_status", ["status"])
    .index("by_start_time", ["startTime"]),
});
