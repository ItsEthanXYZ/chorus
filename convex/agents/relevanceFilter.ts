// Relevance Filter Agent
// Filters search results using LLM-based relevance scoring

import { BaseAgent } from "../lib/baseAgent";
import type { ActionCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import type { RelevanceFilterInput, RelevanceFilterOutput } from "../lib/types";
import { createLLMClient } from "../lib/llm";

/**
 * Relevance Filter Agent
 * Uses LLM to evaluate the actual relevance of search results
 * Filters out results that don't truly answer the user's query
 */
export class RelevanceFilterAgent extends BaseAgent<
  RelevanceFilterInput,
  RelevanceFilterOutput
> {
  constructor(ctx: ActionCtx) {
    super(ctx, "relevance_filter");
  }

  protected async validate(input: RelevanceFilterInput): Promise<void> {
    if (!input.query) {
      throw new Error("Query is required");
    }
    if (!input.results || input.results.length === 0) {
      throw new Error("At least one result is required");
    }
  }

  protected async run(input: RelevanceFilterInput): Promise<RelevanceFilterOutput> {
    this.log(`Filtering ${input.results.length} results for relevance`);

    try {
      const { query, results, threshold = 7.0 } = input;

      // Create LLM client for relevance scoring
      const llm = createLLMClient({
        model: "gpt-4o-mini",
        temperature: 0.3,
      });

      // Score each result in parallel (batch processing)
      const scoredResults = await this.scoreResultsInBatches(
        llm,
        query,
        results,
        5 // Batch size
      );

      // Filter results based on threshold
      const filteredResults = scoredResults
        .filter((result) => result.relevanceScore >= threshold)
        .sort((a, b) => {
          // Sort by relevance score first, then by vector similarity score
          if (Math.abs(b.relevanceScore - a.relevanceScore) > 0.5) {
            return b.relevanceScore - a.relevanceScore;
          }
          return b._score - a._score;
        });

      const removedCount = results.length - filteredResults.length;

      this.log(
        `Filtered to ${filteredResults.length} results (removed ${removedCount})`
      );

      return {
        success: true,
        data: {
          filteredResults,
          removedCount,
        },
      };
    } catch (error: any) {
      this.log(`Error during relevance filtering: ${error.message}`);
      throw error;
    }
  }

  /**
   * Score results in batches to avoid rate limits
   */
  private async scoreResultsInBatches(
    llm: ReturnType<typeof createLLMClient>,
    query: string,
    results: Array<Doc<"documents"> & { _score: number }>,
    batchSize: number
  ): Promise<Array<Doc<"documents"> & { _score: number; relevanceScore: number }>> {
    const scoredResults: Array<
      Doc<"documents"> & { _score: number; relevanceScore: number }
    > = [];

    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);

      const batchScores = await Promise.all(
        batch.map((result) => this.scoreResult(llm, query, result))
      );

      scoredResults.push(...batchScores);

      // Small delay between batches to avoid rate limits
      if (i + batchSize < results.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return scoredResults;
  }

  /**
   * Score a single result for relevance
   */
  private async scoreResult(
    llm: ReturnType<typeof createLLMClient>,
    query: string,
    result: Doc<"documents"> & { _score: number }
  ): Promise<Doc<"documents"> & { _score: number; relevanceScore: number }> {
    try {
      const prompt = `Rate the relevance of this documentation excerpt to the user's query.

User Query: "${query}"

Documentation Excerpt:
---
${result.text.substring(0, 1000)}${result.text.length > 1000 ? "..." : ""}
---

Metadata:
- Service: ${result.service}
- Library: ${result.library}
- Category: ${result.category}
${result.title ? `- Title: ${result.title}` : ""}

Rate from 0-10 where:
- 10 = Directly answers the query with specific, actionable information
- 7-9 = Highly relevant, contains useful information related to the query
- 4-6 = Somewhat relevant, mentions related concepts but lacks specifics
- 1-3 = Marginally relevant, only tangentially related
- 0 = Not relevant at all

Respond with ONLY a number between 0 and 10.`;

      const score = await llm.score(
        result.text.substring(0, 1500),
        prompt,
        0,
        10
      );

      return {
        ...result,
        relevanceScore: score,
      };
    } catch (error) {
      this.log(`Failed to score result ${result._id}: ${error}`);
      // If scoring fails, use a neutral score
      return {
        ...result,
        relevanceScore: 5.0,
      };
    }
  }
}
