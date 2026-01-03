// Update Orchestrator Agent
// Orchestrates the entire documentation update workflow

import { BaseAgent } from "../lib/baseAgent";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type {
  UpdateOrchestratorInput,
  UpdateOrchestratorOutput,
} from "../lib/types";
import { VersionCheckerAgent } from "./versionChecker";
import { LinkFinderAgent } from "./linkFinder";
import { DocumentationScraperAgent } from "./documentationScraper";
import { IngestionAgent } from "./ingestion";

/**
 * Update Orchestrator Agent
 * Coordinates the entire documentation update process:
 * 1. Check for new version
 * 2. Find documentation links
 * 3. Scrape documentation
 * 4. Ingest into database
 * 5. Clean up old versions
 */
export class UpdateOrchestratorAgent extends BaseAgent<
  UpdateOrchestratorInput,
  UpdateOrchestratorOutput
> {
  constructor(ctx: ActionCtx) {
    super(ctx, "update_orchestrator");
  }

  protected async validate(input: UpdateOrchestratorInput): Promise<void> {
    if (!input.service) {
      throw new Error("Service name is required");
    }
  }

  protected async run(
    input: UpdateOrchestratorInput
  ): Promise<UpdateOrchestratorOutput> {
    this.log(`Starting update orchestration for service: ${input.service}`);

    try {
      const { service, forceUpdate = false } = input;

      // Step 1: Get service configuration
      const serviceConfig = await this.getServiceConfig(service);

      if (!serviceConfig) {
        throw new Error(`Service "${service}" not found in database`);
      }

      // Step 2: Check for new version
      this.log("Step 1/5: Checking for new version");
      const versionChecker = new VersionCheckerAgent(this.ctx);
      const versionCheck = await this.callSubAgent(versionChecker, {
        service,
        currentVersion: serviceConfig.currentVersion,
      });

      if (!versionCheck.success || !versionCheck.data) {
        throw new Error("Failed to check version");
      }

      const { latestVersion, currentVersion, needsUpdate } = versionCheck.data;

      // Skip update if not needed and not forced
      if (!needsUpdate && !forceUpdate) {
        this.log("No update needed");
        return {
          success: true,
          data: {
            updated: false,
            oldVersion: currentVersion,
            newVersion: latestVersion,
            documentsAdded: 0,
            documentsRemoved: 0,
          },
        };
      }

      this.log(`Updating from ${currentVersion} to ${latestVersion}`);

      // Step 3: Find documentation links
      this.log("Step 2/5: Finding documentation links");
      const linkFinder = new LinkFinderAgent(this.ctx);
      const linkResults = await this.callSubAgent(linkFinder, {
        service,
        baseUrl: serviceConfig.docsBaseUrl,
        crawlPatterns: serviceConfig.config.crawlPatterns,
        excludePatterns: serviceConfig.config.excludePatterns,
        maxDepth: 2,
      });

      if (!linkResults.success || !linkResults.data) {
        throw new Error("Failed to find documentation links");
      }

      const { links } = linkResults.data;
      this.log(`Found ${links.length} documentation links`);

      // Step 4: Scrape documentation
      this.log("Step 3/5: Scraping documentation");
      const scraper = new DocumentationScraperAgent(this.ctx);
      const scrapeResults = await this.callSubAgent(scraper, {
        urls: links,
        service,
        library: serviceConfig.libraryName,
        version: latestVersion,
      });

      if (!scrapeResults.success || !scrapeResults.data) {
        throw new Error("Failed to scrape documentation");
      }

      const { documents } = scrapeResults.data;
      this.log(`Scraped ${documents.length} documents`);

      // Step 5: Ingest documentation
      this.log("Step 4/5: Ingesting documentation");
      const ingestion = new IngestionAgent(this.ctx);
      const ingestionResults = await this.callSubAgent(ingestion, {
        documents,
        service,
        library: serviceConfig.libraryName,
        version: latestVersion,
        category: "documentation",
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      if (!ingestionResults.success || !ingestionResults.data) {
        throw new Error("Failed to ingest documentation");
      }

      const documentsAdded = ingestionResults.data.totalChunks;
      this.log(`Ingested ${documentsAdded} document chunks`);

      // Step 6: Clean up old version documents
      this.log("Step 5/5: Cleaning up old version");
      const documentsRemoved = await this.removeOldVersionDocuments(
        service,
        serviceConfig.libraryName,
        currentVersion
      );

      this.log(`Removed ${documentsRemoved} old document chunks`);

      // Step 7: Update service record
      await this.updateServiceRecord(
        serviceConfig._id,
        latestVersion
      );

      this.log("Update orchestration completed successfully");

      return {
        success: true,
        data: {
          updated: true,
          oldVersion: currentVersion,
          newVersion: latestVersion,
          documentsAdded,
          documentsRemoved,
        },
      };
    } catch (error: any) {
      this.log(`Error during update orchestration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get service configuration from database
   */
  private async getServiceConfig(service: string) {
    return await this.ctx.runQuery(async (ctx) => {
      return ctx.db
        .query("services")
        .withIndex("by_name", (q) => q.eq("name", service))
        .first();
    });
  }

  /**
   * Remove documents for old version
   */
  private async removeOldVersionDocuments(
    service: string,
    library: string,
    version: string
  ): Promise<number> {
    return await this.ctx.runMutation(async (ctx) => {
      const oldDocs = await ctx.db
        .query("documents")
        .withIndex("by_library_and_version", (q) =>
          q.eq("library", library).eq("version", version)
        )
        .filter((q) => q.eq(q.field("service"), service))
        .collect();

      // Delete in batches
      const deletePromises = oldDocs.map((doc) => ctx.db.delete(doc._id));
      await Promise.all(deletePromises);

      return oldDocs.length;
    });
  }

  /**
   * Update service record with new version and timestamp
   */
  private async updateServiceRecord(
    serviceId: Id<"services">,
    newVersion: string
  ): Promise<void> {
    await this.ctx.runMutation(async (ctx) => {
      const now = Date.now();
      await ctx.db.patch(serviceId, {
        currentVersion: newVersion,
        lastChecked: now,
        lastUpdated: now,
      });
    });
  }
}
