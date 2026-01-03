// Version Checker Agent
// Checks for new versions of libraries/services

import { BaseAgent } from "../lib/baseAgent";
import type { ActionCtx } from "../_generated/server";
import type { VersionCheckerInput, VersionCheckerOutput } from "../lib/types";

/**
 * Version Checker Agent
 * Checks if a new version of a library/service is available
 * Supports NPM, GitHub, and custom version checking
 */
export class VersionCheckerAgent extends BaseAgent<
  VersionCheckerInput,
  VersionCheckerOutput
> {
  constructor(ctx: ActionCtx) {
    super(ctx, "version_checker");
  }

  protected async validate(input: VersionCheckerInput): Promise<void> {
    if (!input.service) {
      throw new Error("Service name is required");
    }
  }

  protected async run(input: VersionCheckerInput): Promise<VersionCheckerOutput> {
    this.log(`Checking version for service: ${input.service}`);

    try {
      const { service, currentVersion } = input;

      // Step 1: Get service configuration from database
      const serviceConfig = await this.ctx.runQuery(async (ctx) => {
        return ctx.db
          .query("services")
          .withIndex("by_name", (q) => q.eq("name", service))
          .first();
      });

      if (!serviceConfig) {
        throw new Error(`Service "${service}" not found in database`);
      }

      // Step 2: Check for latest version based on configuration
      const latestVersion = await this.checkLatestVersion(
        serviceConfig.libraryName,
        serviceConfig.config.versionCheckMethod || "npm",
        serviceConfig.config.versionCheckUrl
      );

      // Step 3: Compare versions
      const storedVersion = currentVersion || serviceConfig.currentVersion;
      const needsUpdate = this.compareVersions(storedVersion, latestVersion) < 0;

      this.log(
        `Version check: stored=${storedVersion}, latest=${latestVersion}, needsUpdate=${needsUpdate}`
      );

      // Step 4: Fetch changelog if version is different
      let changelog: string | undefined;
      if (needsUpdate) {
        changelog = await this.fetchChangelog(
          serviceConfig.libraryName,
          storedVersion,
          latestVersion
        );
      }

      return {
        success: true,
        data: {
          latestVersion,
          currentVersion: storedVersion,
          needsUpdate,
          changelog,
        },
      };
    } catch (error: any) {
      this.log(`Error checking version: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check latest version from various sources
   */
  private async checkLatestVersion(
    libraryName: string,
    method: string,
    customUrl?: string
  ): Promise<string> {
    switch (method) {
      case "npm":
        return this.checkNpmVersion(libraryName);
      case "github":
        return this.checkGitHubVersion(libraryName);
      case "scrape":
        if (!customUrl) {
          throw new Error("Custom URL required for scrape method");
        }
        return this.checkScrapedVersion(customUrl);
      default:
        throw new Error(`Unsupported version check method: ${method}`);
    }
  }

  /**
   * Check version from NPM registry
   */
  private async checkNpmVersion(packageName: string): Promise<string> {
    try {
      const response = await fetch(
        `https://registry.npmjs.org/${packageName}/latest`
      );

      if (!response.ok) {
        throw new Error(`NPM registry returned ${response.status}`);
      }

      const data = await response.json();
      return data.version;
    } catch (error) {
      this.log(`Failed to check NPM version: ${error}`);
      throw new Error(`Failed to check NPM version for ${packageName}`);
    }
  }

  /**
   * Check version from GitHub releases
   */
  private async checkGitHubVersion(repoPath: string): Promise<string> {
    try {
      // repoPath should be in format "owner/repo"
      const response = await fetch(
        `https://api.github.com/repos/${repoPath}/releases/latest`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "DocBot/1.0",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const data = await response.json();
      // Remove leading 'v' if present
      return data.tag_name.replace(/^v/, "");
    } catch (error) {
      this.log(`Failed to check GitHub version: ${error}`);
      throw new Error(`Failed to check GitHub version for ${repoPath}`);
    }
  }

  /**
   * Check version by scraping a custom URL
   */
  private async checkScrapedVersion(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      const html = await response.text();

      // Try to find version in common patterns
      const patterns = [
        /version[:\s]+([0-9]+\.[0-9]+\.[0-9]+)/i,
        /v([0-9]+\.[0-9]+\.[0-9]+)/i,
        /([0-9]+\.[0-9]+\.[0-9]+)/,
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          return match[1];
        }
      }

      throw new Error("Could not find version in scraped content");
    } catch (error) {
      this.log(`Failed to scrape version: ${error}`);
      throw new Error(`Failed to scrape version from ${url}`);
    }
  }

  /**
   * Compare two semantic versions
   * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split(".").map(Number);
    const parts2 = v2.split(".").map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }

    return 0;
  }

  /**
   * Fetch changelog between versions
   */
  private async fetchChangelog(
    libraryName: string,
    oldVersion: string,
    newVersion: string
  ): Promise<string | undefined> {
    try {
      // Try to fetch from NPM changelog
      const response = await fetch(
        `https://registry.npmjs.org/${libraryName}/${newVersion}`
      );

      if (!response.ok) {
        return undefined;
      }

      const data = await response.json();

      // Return basic changelog info
      return `Version ${newVersion} released. Check the package documentation for detailed changes.`;
    } catch (error) {
      this.log(`Failed to fetch changelog: ${error}`);
      return undefined;
    }
  }
}
