/**
 * Example service configurations for popular libraries and frameworks
 * Use these as templates when registering new services
 */

import { api } from "../convex/_generated/api";

/**
 * Example: Register Convex documentation
 */
export const convexConfig = {
  name: "convex",
  displayName: "Convex",
  libraryName: "convex",
  currentVersion: "1.31.2",
  docsBaseUrl: "https://docs.convex.dev",
  crawlPatterns: [
    "/docs/",
    "/api/",
    "/tutorial/",
    "/production/",
    "/database/",
    "/functions/",
  ],
  excludePatterns: [
    "/blog/",
    "/changelog/",
    "/community/",
  ],
  versionCheckMethod: "npm",
};

/**
 * Example: Register LangChain documentation
 */
export const langchainConfig = {
  name: "langchain",
  displayName: "LangChain",
  libraryName: "@langchain/core",
  currentVersion: "1.1.8",
  docsBaseUrl: "https://js.langchain.com",
  crawlPatterns: [
    "/docs/",
    "/api/",
    "/guides/",
  ],
  excludePatterns: [
    "/blog/",
    "/tutorials/external/",
  ],
  versionCheckMethod: "npm",
};

/**
 * Example: Register OpenAI documentation
 */
export const openaiConfig = {
  name: "openai",
  displayName: "OpenAI",
  libraryName: "openai",
  currentVersion: "4.28.0",
  docsBaseUrl: "https://platform.openai.com/docs",
  crawlPatterns: [
    "/docs/",
    "/api-reference/",
    "/guides/",
  ],
  excludePatterns: [
    "/examples/",
    "/changelog/",
  ],
  versionCheckMethod: "npm",
};

/**
 * Example: Register Next.js documentation
 */
export const nextjsConfig = {
  name: "nextjs",
  displayName: "Next.js",
  libraryName: "next",
  currentVersion: "14.1.0",
  docsBaseUrl: "https://nextjs.org",
  crawlPatterns: [
    "/docs/",
    "/learn/",
  ],
  excludePatterns: [
    "/blog/",
    "/showcase/",
    "/templates/",
  ],
  versionCheckMethod: "npm",
};

/**
 * Example: Register React documentation
 */
export const reactConfig = {
  name: "react",
  displayName: "React",
  libraryName: "react",
  currentVersion: "18.2.0",
  docsBaseUrl: "https://react.dev",
  crawlPatterns: [
    "/learn/",
    "/reference/",
  ],
  excludePatterns: [
    "/blog/",
    "/community/",
  ],
  versionCheckMethod: "npm",
};

/**
 * Example: Register TypeScript documentation
 */
export const typescriptConfig = {
  name: "typescript",
  displayName: "TypeScript",
  libraryName: "typescript",
  currentVersion: "5.3.3",
  docsBaseUrl: "https://www.typescriptlang.org",
  crawlPatterns: [
    "/docs/",
    "/handbook/",
  ],
  excludePatterns: [
    "/play/",
    "/community/",
  ],
  versionCheckMethod: "npm",
};

/**
 * Example: Register Firebase documentation
 */
export const firebaseConfig = {
  name: "firebase",
  displayName: "Firebase",
  libraryName: "firebase",
  currentVersion: "10.8.0",
  docsBaseUrl: "https://firebase.google.com/docs",
  crawlPatterns: [
    "/docs/",
    "/reference/",
  ],
  excludePatterns: [
    "/docs/projects/",
    "/codelabs/",
  ],
  versionCheckMethod: "npm",
};

/**
 * Example: Register a GitHub project
 * For projects that don't publish to NPM
 */
export const customGitHubProjectConfig = {
  name: "custom-project",
  displayName: "Custom GitHub Project",
  libraryName: "owner/repo", // GitHub format
  currentVersion: "1.0.0",
  docsBaseUrl: "https://docs.customproject.dev",
  crawlPatterns: [
    "/docs/",
  ],
  excludePatterns: [],
  versionCheckUrl: "owner/repo", // GitHub repo path
  versionCheckMethod: "github",
};

/**
 * Example: Register a project with custom version checking
 * For projects that need web scraping to find version
 */
export const customVersionCheckConfig = {
  name: "custom-project-scrape",
  displayName: "Custom Project (Scraped Version)",
  libraryName: "custom-package",
  currentVersion: "2.0.0",
  docsBaseUrl: "https://docs.customproject.dev",
  crawlPatterns: [
    "/docs/",
  ],
  excludePatterns: [],
  versionCheckUrl: "https://docs.customproject.dev/version", // Custom URL
  versionCheckMethod: "scrape",
};

/**
 * Helper function to register all example services
 * Use this to quickly populate your system with common documentation
 */
export async function registerAllExampleServices(convex: any) {
  const configs = [
    convexConfig,
    langchainConfig,
    openaiConfig,
    nextjsConfig,
    reactConfig,
    typescriptConfig,
    firebaseConfig,
  ];

  const results = [];

  for (const config of configs) {
    try {
      const serviceId = await convex.mutation(api.services.registerService, config);
      results.push({ service: config.name, success: true, serviceId });
      console.log(`✓ Registered ${config.displayName}`);
    } catch (error: any) {
      results.push({ service: config.name, success: false, error: error.message });
      console.error(`✗ Failed to register ${config.displayName}: ${error.message}`);
    }
  }

  return results;
}

/**
 * Helper function to update all services
 */
export async function updateAllServices(convex: any) {
  const services = await convex.query(api.services.listServices);

  const results = [];

  for (const service of services) {
    try {
      const result = await convex.action(api.agentAPI.checkAndUpdateService, {
        service: service.name,
        autoUpdate: true,
      });
      results.push({ service: service.name, ...result });
      console.log(`✓ Checked ${service.displayName}`);
    } catch (error: any) {
      results.push({ service: service.name, success: false, error: error.message });
      console.error(`✗ Failed to check ${service.displayName}: ${error.message}`);
    }
  }

  return results;
}
