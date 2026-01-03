# Chorus - Multi-LLM Documentation Agent System

A sophisticated multi-agent system for automatically fetching, updating, ingesting, and searching code documentation using LLMs and vector embeddings.

## Overview

Chorus is an intelligent documentation management system that:
- 🔍 **Automatically discovers** documentation links for libraries/services
- 📥 **Scrapes and ingests** documentation using Firecrawl
- 🤖 **Uses LLM agents** for intelligent processing and filtering
- 🔄 **Auto-updates** documentation when new versions are detected
- 🎯 **Provides semantic search** with relevance filtering
- 📚 **Extracts best practices** from documentation
- 🏷️ **Filters by service** to get only relevant documentation

## Architecture

### Agent System

The system is built around specialized agents that can call each other as subagents:

1. **Link Finder Agent** - Discovers documentation URLs
2. **Documentation Scraper Agent** - Scrapes content using Firecrawl
3. **Ingestion Agent** - Chunks text and generates embeddings
4. **Search Agent** - Performs semantic search with filtering
5. **Relevance Filter Agent** - Uses LLM to filter search results
6. **Best Practices Checker Agent** - Extracts best practices
7. **Version Checker Agent** - Checks for new versions (NPM, GitHub, etc.)
8. **Update Orchestrator Agent** - Coordinates the entire update workflow

### Technology Stack

- **Backend**: Convex (serverless backend)
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions)
- **LLMs**: OpenAI GPT-4o-mini (expandable to Anthropic Claude, etc.)
- **Scraping**: Firecrawl (with fallback to basic scraping)
- **Text Splitting**: LangChain RecursiveCharacterTextSplitter
- **Vector Search**: Convex vector search with metadata filtering

## Database Schema

### Documents Table
Stores documentation chunks with embeddings:
```typescript
{
  embedding: number[],          // 1536-dimensional vector
  text: string,                 // Document chunk content
  service: string,              // e.g., "convex", "langchain"
  library: string,              // NPM package name
  version: string,              // Semantic version
  category: string,             // e.g., "api-reference", "guide"
  sourceUrl: string,            // Original URL
  title?: string,               // Page title
  chunkIndex: number,           // Chunk order
  lastUpdated: number,          // Timestamp
  metadata?: any                // Additional metadata
}
```

### Services Table
Tracks registered services and their configurations:
```typescript
{
  name: string,                 // Service identifier
  displayName: string,          // Human-readable name
  currentVersion: string,       // Latest version
  libraryName: string,          // NPM package name
  docsBaseUrl: string,          // Documentation base URL
  lastChecked: number,          // Last version check
  lastUpdated: number,          // Last docs update
  config: {
    crawlPatterns: string[],    // URL patterns to crawl
    excludePatterns?: string[], // Patterns to exclude
    versionCheckUrl?: string,   // Custom version check URL
    versionCheckMethod?: string // "npm", "github", "scrape"
  }
}
```

### Agent Logs Table
Tracks agent execution for debugging:
```typescript
{
  agentType: string,            // Agent type
  service?: string,             // Related service
  status: string,               // "running", "completed", "failed"
  startTime: number,
  endTime?: number,
  input: any,                   // Agent input
  output?: any,                 // Agent output
  error?: string,               // Error message
  metadata?: any
}
```

## Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment Variables

Create a `.env` file:

```bash
# Required
OPEN_AI_API_KEY=your_openai_api_key

# Optional (for Firecrawl)
FIRECRAWL_API_KEY=your_firecrawl_api_key
```

### 3. Start Convex Development Server

```bash
bun run dev
```

## Usage

### Register a Service

First, register a service to track its documentation:

```typescript
import { api } from "./convex/_generated/api";

await convex.mutation(api.services.registerService, {
  name: "convex",
  displayName: "Convex",
  libraryName: "convex",
  currentVersion: "1.31.2",
  docsBaseUrl: "https://docs.convex.dev",
  crawlPatterns: ["/docs/", "/api/"],
  excludePatterns: ["/blog/", "/changelog/"],
  versionCheckMethod: "npm",
});
```

### Search Documentation

Search across all or specific services:

```typescript
// Basic search
const results = await convex.action(api.agentAPI.searchDocumentation, {
  query: "How do I use mutations?",
  services: ["convex"],
  limit: 10,
});

// Search with relevance filtering
const filteredResults = await convex.action(api.agentAPI.searchDocumentation, {
  query: "Best way to handle real-time updates",
  services: ["convex", "langchain"],
  filterRelevance: true,
  relevanceThreshold: 8.0,
});
```

### Get Best Practices

Extract best practices for a specific topic:

```typescript
const bestPractices = await convex.action(api.agentAPI.getBestPractices, {
  query: "authentication and security",
  service: "convex",
  context: ["Using JWT tokens", "Session management"],
});

// Returns:
// {
//   success: true,
//   data: {
//     bestPractices: [
//       {
//         practice: "Always validate auth tokens on the backend",
//         source: "Convex Security Guide",
//         relevance: 9
//       },
//       ...
//     ]
//   }
// }
```

### Check and Update Documentation

```typescript
// Check for updates
const versionCheck = await convex.action(api.agentAPI.checkAndUpdateService, {
  service: "convex",
  autoUpdate: false,
});

// Force update documentation
const updateResult = await convex.action(api.agentAPI.updateServiceDocumentation, {
  service: "convex",
});

// Returns:
// {
//   success: true,
//   data: {
//     updated: true,
//     oldVersion: "1.31.0",
//     newVersion: "1.31.2",
//     documentsAdded: 450,
//     documentsRemoved: 420
//   }
// }
```

### Manual Ingestion

Manually ingest documentation from specific URLs:

```typescript
const result = await convex.action(api.agentAPI.ingestDocumentation, {
  urls: [
    "https://docs.convex.dev/getting-started",
    "https://docs.convex.dev/functions",
  ],
  service: "convex",
  library: "convex",
  version: "1.31.2",
  category: "guide",
  chunkSize: 1000,
  chunkOverlap: 200,
});
```

### Advanced Search with Best Practices

Get both documentation and best practices in one call:

```typescript
const comprehensive = await convex.action(api.agentAPI.searchWithBestPractices, {
  query: "How to optimize database queries",
  service: "convex",
  includeVersions: ["1.31.2"],
});

// Returns both:
// - Relevant documentation chunks
// - Extracted best practices
```

### Service Filtering

Filter search results by multiple services:

```typescript
// Search only in Convex docs
const convexDocs = await convex.action(api.agentAPI.searchDocumentation, {
  query: "real-time updates",
  services: ["convex"],
});

// Search across multiple services
const multiService = await convex.action(api.agentAPI.searchDocumentation, {
  query: "vector embeddings",
  services: ["langchain", "openai"],
});

// Search specific versions
const versionSpecific = await convex.action(api.agentAPI.searchDocumentation, {
  query: "new features",
  services: ["convex"],
  versions: ["1.31.2"],
});

// Filter by category
const apiReference = await convex.action(api.agentAPI.searchDocumentation, {
  query: "database methods",
  services: ["convex"],
  categories: ["api-reference"],
});
```

## Agent Workflow

### Automatic Update Workflow

When triggered (manually or by version detection), the Update Orchestrator:

1. **Version Checker** - Checks NPM/GitHub/custom URL for new version
2. **Link Finder** - Discovers documentation URLs using sitemap + crawling
3. **Documentation Scraper** - Scrapes content using Firecrawl
4. **Ingestion Agent** - Splits text and generates embeddings
5. **Cleanup** - Removes old version documentation
6. **Update Service** - Updates service record with new version

### Search Workflow

1. **Search Agent** - Performs vector similarity search with filters
2. **Post-filtering** - Applies multiple service/version filters
3. **(Optional) Relevance Filter** - LLM scores each result for relevance
4. **Sort & Return** - Sorted by relevance + similarity score

## API Reference

### Main Endpoints

#### `searchDocumentation(args)`
Search documentation with optional filtering and relevance scoring.

**Args:**
- `query: string` - Search query
- `services?: string[]` - Filter by services
- `libraries?: string[]` - Filter by libraries
- `versions?: string[]` - Filter by versions
- `categories?: string[]` - Filter by categories
- `limit?: number` - Max results (default: 20)
- `filterRelevance?: boolean` - Apply LLM relevance filtering
- `relevanceThreshold?: number` - Min relevance score (0-10)

#### `getBestPractices(args)`
Extract best practices for a query.

**Args:**
- `query: string` - Search query
- `service: string` - Service name
- `context?: string[]` - Additional context

#### `checkAndUpdateService(args)`
Check version and optionally update.

**Args:**
- `service: string` - Service name
- `autoUpdate?: boolean` - Auto-update if new version found

#### `updateServiceDocumentation(args)`
Force update documentation.

**Args:**
- `service: string` - Service name

#### `ingestDocumentation(args)`
Manually ingest documentation.

**Args:**
- `urls: string[]` - URLs to scrape
- `service: string` - Service name
- `library: string` - Library name
- `version: string` - Version
- `category: string` - Category
- `chunkSize?: number` - Chunk size (default: 1000)
- `chunkOverlap?: number` - Overlap (default: 200)

### Service Management

#### `registerService(args)`
Register a new service.

#### `updateService(args)`
Update service configuration.

#### `listServices()`
Get all registered services.

#### `getService(name)`
Get service by name.

#### `deleteService(serviceId)`
Delete service and all its documentation.

#### `getServiceStats(serviceName)`
Get documentation statistics for a service.

## Extending the System

### Adding a New Agent

1. Create a new agent file in `convex/agents/`:

```typescript
import { BaseAgent } from "../lib/baseAgent";
import type { ActionCtx } from "../_generated/server";

export class MyCustomAgent extends BaseAgent<MyInput, MyOutput> {
  constructor(ctx: ActionCtx) {
    super(ctx, "my_custom_agent");
  }

  protected async run(input: MyInput): Promise<MyOutput> {
    // Agent logic here
  }
}
```

2. Add type definitions in `convex/lib/types.ts`
3. Expose via API in `convex/agentAPI.ts`

### Adding LLM Support

The system supports multiple LLM providers. To add a new provider:

1. Update `convex/lib/llm.ts`:

```typescript
private async chatNewProvider(messages: LLMMessage[]): Promise<string> {
  // Implement new provider
}
```

2. Add provider to type definitions
3. Update the `chat()` method switch statement

## Monitoring

### View Agent Logs

```typescript
const logs = await convex.query(api.agentAPI.getAgentLogs, {
  agentType: "version_checker",
  limit: 50,
});
```

### Service Statistics

```typescript
const stats = await convex.query(api.services.getServiceStats, {
  serviceName: "convex",
});

// Returns:
// {
//   totalDocuments: 450,
//   versions: [
//     {
//       version: "1.31.2",
//       documentCount: 450,
//       categories: ["api-reference", "guide", "tutorial"]
//     }
//   ]
// }
```

## Best Practices

1. **Service Registration**: Always register services before ingestion
2. **Version Management**: Use semantic versioning (e.g., "1.2.3")
3. **Chunk Size**: 1000 characters works well for most documentation
4. **Overlap**: 200 characters ensures context isn't lost between chunks
5. **Categories**: Use consistent categories ("api-reference", "guide", "tutorial", etc.)
6. **Relevance Filtering**: Use threshold of 7-8 for production queries
7. **Service Filtering**: Specify services to avoid irrelevant results

## Troubleshooting

### No search results
- Check if service is registered
- Verify documentation is ingested
- Try broader search terms
- Lower relevance threshold

### Slow searches
- Reduce `limit` parameter
- Disable relevance filtering for faster results
- Use more specific service filters

### Version not updating
- Check version check method configuration
- Verify NPM package name or GitHub repo path
- Check API rate limits

## Future Enhancements

- [ ] Support for more LLM providers (Anthropic Claude, local models)
- [ ] Scheduled automatic updates (cron-based)
- [ ] Document change detection (only update changed pages)
- [ ] Multi-language support
- [ ] Documentation quality scoring
- [ ] User feedback loop for relevance tuning
- [ ] GraphQL API support
- [ ] Documentation summaries and TL;DR generation

## License

MIT

## Contributing

Contributions welcome! Please see CONTRIBUTING.md for guidelines.
