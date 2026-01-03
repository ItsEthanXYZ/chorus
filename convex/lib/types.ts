// Type definitions for the multi-LLM agent system

import { Doc, Id } from "../_generated/dataModel";

// Agent Types
export type AgentType =
  | "link_finder"
  | "documentation_scraper"
  | "ingestion"
  | "search"
  | "relevance_filter"
  | "best_practices_checker"
  | "version_checker"
  | "update_orchestrator";

// Agent Status
export type AgentStatus = "pending" | "running" | "completed" | "failed";

// Base Agent Input/Output
export interface BaseAgentInput {
  service?: string;
  [key: string]: any;
}

export interface BaseAgentOutput {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: any;
}

// Link Finder Agent
export interface LinkFinderInput extends BaseAgentInput {
  service: string;
  baseUrl: string;
  crawlPatterns?: string[];
  excludePatterns?: string[];
  maxDepth?: number;
}

export interface LinkFinderOutput extends BaseAgentOutput {
  data?: {
    links: string[];
    totalFound: number;
  };
}

// Documentation Scraper Agent
export interface DocumentationScraperInput extends BaseAgentInput {
  urls: string[];
  service: string;
  library: string;
  version: string;
}

export interface DocumentationScraperOutput extends BaseAgentOutput {
  data?: {
    documents: Array<{
      url: string;
      content: string;
      title?: string;
      markdown?: string;
    }>;
    totalScraped: number;
  };
}

// Ingestion Agent
export interface IngestionAgentInput extends BaseAgentInput {
  documents: Array<{
    content: string;
    url: string;
    title?: string;
  }>;
  service: string;
  library: string;
  version: string;
  category: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface IngestionAgentOutput extends BaseAgentOutput {
  data?: {
    documentIds: Id<"documents">[];
    totalChunks: number;
  };
}

// Search Agent
export interface SearchAgentInput extends BaseAgentInput {
  query: string;
  services?: string[];
  libraries?: string[];
  versions?: string[];
  categories?: string[];
  limit?: number;
}

export interface SearchAgentOutput extends BaseAgentOutput {
  data?: {
    results: Array<Doc<"documents"> & { _score: number }>;
    totalResults: number;
  };
}

// Relevance Filter Agent
export interface RelevanceFilterInput extends BaseAgentInput {
  query: string;
  results: Array<Doc<"documents"> & { _score: number }>;
  threshold?: number;
}

export interface RelevanceFilterOutput extends BaseAgentOutput {
  data?: {
    filteredResults: Array<Doc<"documents"> & { _score: number; relevanceScore: number }>;
    removedCount: number;
  };
}

// Best Practices Checker Agent
export interface BestPracticesCheckerInput extends BaseAgentInput {
  query: string;
  service: string;
  context?: string[];
}

export interface BestPracticesCheckerOutput extends BaseAgentOutput {
  data?: {
    bestPractices: Array<{
      practice: string;
      source: string;
      relevance: number;
    }>;
  };
}

// Version Checker Agent
export interface VersionCheckerInput extends BaseAgentInput {
  service: string;
  currentVersion?: string;
}

export interface VersionCheckerOutput extends BaseAgentOutput {
  data?: {
    latestVersion: string;
    currentVersion?: string;
    needsUpdate: boolean;
    changelog?: string;
  };
}

// Update Orchestrator Agent
export interface UpdateOrchestratorInput extends BaseAgentInput {
  service: string;
  forceUpdate?: boolean;
}

export interface UpdateOrchestratorOutput extends BaseAgentOutput {
  data?: {
    updated: boolean;
    oldVersion?: string;
    newVersion?: string;
    documentsAdded: number;
    documentsRemoved: number;
  };
}

// LLM Provider Types
export type LLMProvider = "openai" | "anthropic";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: LLMProvider;
}

// Service Configuration
export interface ServiceConfig {
  name: string;
  displayName: string;
  libraryName: string;
  docsBaseUrl: string;
  crawlPatterns: string[];
  excludePatterns?: string[];
  versionCheckUrl?: string;
  versionCheckMethod?: "npm" | "github" | "scrape";
}

// Document Metadata
export interface DocumentMetadata {
  service: string;
  library: string;
  version: string;
  category: string;
  sourceUrl: string;
  title?: string;
  chunkIndex: number;
  lastUpdated: number;
  [key: string]: any;
}
