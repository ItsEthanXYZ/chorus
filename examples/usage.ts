/**
 * Usage examples for the Chorus Multi-LLM Documentation Agent System
 */

import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// Initialize Convex client
const convex = new ConvexClient(process.env.CONVEX_URL!);

/**
 * Example 1: Register a service and ingest documentation
 */
async function example1_RegisterAndIngestService() {
  console.log("Example 1: Register and ingest Convex documentation\n");

  // Step 1: Register the service
  const serviceId = await convex.mutation(api.services.registerService, {
    name: "convex",
    displayName: "Convex",
    libraryName: "convex",
    currentVersion: "1.31.2",
    docsBaseUrl: "https://docs.convex.dev",
    crawlPatterns: ["/docs/"],
    excludePatterns: ["/blog/"],
    versionCheckMethod: "npm",
  });

  console.log("✓ Service registered:", serviceId);

  // Step 2: Trigger documentation update
  const updateResult = await convex.action(api.agentAPI.updateServiceDocumentation, {
    service: "convex",
  });

  console.log("✓ Documentation updated:");
  console.log(`  - Version: ${updateResult.data?.newVersion}`);
  console.log(`  - Documents added: ${updateResult.data?.documentsAdded}`);
  console.log(`  - Documents removed: ${updateResult.data?.documentsRemoved}`);
}

/**
 * Example 2: Search documentation with filtering
 */
async function example2_SearchDocumentation() {
  console.log("\nExample 2: Search documentation\n");

  // Basic search
  const basicSearch = await convex.action(api.agentAPI.searchDocumentation, {
    query: "How do I create a mutation?",
    services: ["convex"],
    limit: 5,
  });

  console.log("Basic search results:");
  basicSearch.data?.results.forEach((result, i) => {
    console.log(`\n[${i + 1}] ${result.title || result.sourceUrl}`);
    console.log(`   Score: ${result._score}`);
    console.log(`   Preview: ${result.text.substring(0, 100)}...`);
  });

  // Search with relevance filtering
  const filteredSearch = await convex.action(api.agentAPI.searchDocumentation, {
    query: "Best practices for database queries",
    services: ["convex"],
    filterRelevance: true,
    relevanceThreshold: 8.0,
    limit: 5,
  });

  console.log("\n\nFiltered search results:");
  console.log(`Found ${filteredSearch.data?.results.length} highly relevant results`);
  console.log(`Filtered out ${filteredSearch.data?.filteredOut} less relevant results`);
}

/**
 * Example 3: Get best practices
 */
async function example3_GetBestPractices() {
  console.log("\nExample 3: Get best practices\n");

  const result = await convex.action(api.agentAPI.getBestPractices, {
    query: "authentication and security",
    service: "convex",
    context: ["User authentication", "Session management"],
  });

  console.log("Best Practices:");
  result.data?.bestPractices.forEach((bp, i) => {
    console.log(`\n[${i + 1}] ${bp.practice}`);
    console.log(`   Source: ${bp.source}`);
    console.log(`   Relevance: ${bp.relevance}/10`);
  });
}

/**
 * Example 4: Check and auto-update service
 */
async function example4_AutoUpdate() {
  console.log("\nExample 4: Auto-update service\n");

  const result = await convex.action(api.agentAPI.checkAndUpdateService, {
    service: "convex",
    autoUpdate: true,
  });

  if (result.data?.updated) {
    console.log("✓ Service updated!");
    console.log(`  From: ${result.data.oldVersion}`);
    console.log(`  To: ${result.data.newVersion}`);
    console.log(`  Documents added: ${result.data.documentsAdded}`);
  } else {
    console.log("✓ Service is up to date");
    console.log(`  Current version: ${result.data?.currentVersion}`);
  }
}

/**
 * Example 5: Search across multiple services
 */
async function example5_MultiServiceSearch() {
  console.log("\nExample 5: Multi-service search\n");

  const result = await convex.action(api.agentAPI.searchDocumentation, {
    query: "vector embeddings and semantic search",
    services: ["langchain", "openai"],
    limit: 10,
  });

  console.log(`Found ${result.data?.results.length} results across services:`);

  // Group by service
  const byService = result.data?.results.reduce((acc, doc) => {
    if (!acc[doc.service]) acc[doc.service] = [];
    acc[doc.service].push(doc);
    return acc;
  }, {} as Record<string, any[]>);

  Object.entries(byService || {}).forEach(([service, docs]) => {
    console.log(`\n${service}: ${docs.length} results`);
    docs.slice(0, 2).forEach((doc) => {
      console.log(`  - ${doc.title || doc.sourceUrl}`);
    });
  });
}

/**
 * Example 6: Advanced search with best practices
 */
async function example6_AdvancedSearch() {
  console.log("\nExample 6: Advanced search with best practices\n");

  const result = await convex.action(api.agentAPI.searchWithBestPractices, {
    query: "optimizing database performance",
    service: "convex",
    includeVersions: ["1.31.2"],
  });

  console.log("Documentation:");
  result.data?.documentation?.filteredResults?.slice(0, 3).forEach((doc, i) => {
    console.log(`\n[${i + 1}] ${doc.title || doc.sourceUrl}`);
    console.log(`   Score: ${doc._score} | Relevance: ${doc.relevanceScore}/10`);
  });

  console.log("\n\nBest Practices:");
  result.data?.bestPractices?.bestPractices?.slice(0, 3).forEach((bp, i) => {
    console.log(`\n[${i + 1}] ${bp.practice}`);
    console.log(`   Relevance: ${bp.relevance}/10`);
  });
}

/**
 * Example 7: Manually ingest specific URLs
 */
async function example7_ManualIngestion() {
  console.log("\nExample 7: Manual ingestion\n");

  const result = await convex.action(api.agentAPI.ingestDocumentation, {
    urls: [
      "https://docs.convex.dev/getting-started",
      "https://docs.convex.dev/functions/mutations",
    ],
    service: "convex",
    library: "convex",
    version: "1.31.2",
    category: "guide",
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  console.log("✓ Documentation ingested:");
  console.log(`  - Total chunks: ${result.data?.totalChunks}`);
  console.log(`  - Document IDs: ${result.data?.documentIds.length}`);
}

/**
 * Example 8: Service management
 */
async function example8_ServiceManagement() {
  console.log("\nExample 8: Service management\n");

  // List all services
  const services = await convex.query(api.services.listServices);
  console.log(`Total services: ${services.length}`);

  // Get statistics for each service
  for (const service of services.slice(0, 3)) {
    const stats = await convex.query(api.services.getServiceStats, {
      serviceName: service.name,
    });

    console.log(`\n${service.displayName}:`);
    console.log(`  Current version: ${service.currentVersion}`);
    console.log(`  Total documents: ${stats.totalDocuments}`);
    console.log(`  Versions: ${stats.versions.map((v) => v.version).join(", ")}`);
  }
}

/**
 * Example 9: Monitor agent execution
 */
async function example9_MonitorAgents() {
  console.log("\nExample 9: Monitor agent execution\n");

  // Get recent logs
  const logs = await convex.query(api.agentAPI.getAgentLogs, {
    limit: 10,
  });

  console.log(`Recent agent executions (${logs.length}):`);
  logs.forEach((log, i) => {
    const duration = log.endTime ? log.endTime - log.startTime : "ongoing";
    console.log(`\n[${i + 1}] ${log.agentType}`);
    console.log(`   Status: ${log.status}`);
    console.log(`   Duration: ${duration}ms`);
    if (log.error) {
      console.log(`   Error: ${log.error}`);
    }
  });

  // Get logs for specific agent type
  const updateLogs = await convex.query(api.agentAPI.getAgentLogs, {
    agentType: "update_orchestrator",
    limit: 5,
  });

  console.log(`\n\nUpdate orchestrator logs (${updateLogs.length}):`);
  updateLogs.forEach((log) => {
    console.log(`- ${log.status} at ${new Date(log.startTime).toISOString()}`);
  });
}

/**
 * Example 10: Filter by categories and versions
 */
async function example10_AdvancedFiltering() {
  console.log("\nExample 10: Advanced filtering\n");

  // Search only API reference documentation
  const apiDocs = await convex.action(api.agentAPI.searchDocumentation, {
    query: "database methods",
    services: ["convex"],
    categories: ["api-reference"],
    limit: 5,
  });

  console.log("API Reference results:");
  console.log(`Found ${apiDocs.data?.results.length} results`);

  // Search only guides and tutorials
  const guides = await convex.action(api.agentAPI.searchDocumentation, {
    query: "getting started",
    services: ["convex"],
    categories: ["guide", "tutorial"],
    limit: 5,
  });

  console.log("\nGuide/Tutorial results:");
  console.log(`Found ${guides.data?.results.length} results`);

  // Search specific version
  const versionSpecific = await convex.action(api.agentAPI.searchDocumentation, {
    query: "new features",
    services: ["convex"],
    versions: ["1.31.2"],
    limit: 5,
  });

  console.log("\nVersion-specific results:");
  console.log(`Found ${versionSpecific.data?.results.length} results for v1.31.2`);
}

// Run examples
async function runAllExamples() {
  try {
    await example1_RegisterAndIngestService();
    await example2_SearchDocumentation();
    await example3_GetBestPractices();
    await example4_AutoUpdate();
    await example5_MultiServiceSearch();
    await example6_AdvancedSearch();
    await example7_ManualIngestion();
    await example8_ServiceManagement();
    await example9_MonitorAgents();
    await example10_AdvancedFiltering();
  } catch (error) {
    console.error("Error running examples:", error);
  } finally {
    convex.close();
  }
}

// Export individual examples for selective running
export {
  example1_RegisterAndIngestService,
  example2_SearchDocumentation,
  example3_GetBestPractices,
  example4_AutoUpdate,
  example5_MultiServiceSearch,
  example6_AdvancedSearch,
  example7_ManualIngestion,
  example8_ServiceManagement,
  example9_MonitorAgents,
  example10_AdvancedFiltering,
  runAllExamples,
};
