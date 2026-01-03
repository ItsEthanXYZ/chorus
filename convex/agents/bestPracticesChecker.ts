// Best Practices Checker Agent
// Identifies best practices from documentation

import { BaseAgent } from "../lib/baseAgent";
import type { ActionCtx } from "../_generated/server";
import type {
  BestPracticesCheckerInput,
  BestPracticesCheckerOutput,
} from "../lib/types";
import { SearchAgent } from "./search";
import { createLLMClient } from "../lib/llm";

/**
 * Best Practices Checker Agent
 * Searches for and extracts best practices from documentation
 * Uses Search Agent as a subagent and LLM for extraction
 */
export class BestPracticesCheckerAgent extends BaseAgent<
  BestPracticesCheckerInput,
  BestPracticesCheckerOutput
> {
  constructor(ctx: ActionCtx) {
    super(ctx, "best_practices_checker");
  }

  protected async validate(input: BestPracticesCheckerInput): Promise<void> {
    if (!input.query) {
      throw new Error("Query is required");
    }
    if (!input.service) {
      throw new Error("Service name is required");
    }
  }

  protected async run(
    input: BestPracticesCheckerInput
  ): Promise<BestPracticesCheckerOutput> {
    this.log(`Checking best practices for: "${input.query}" in ${input.service}`);

    try {
      const { query, service, context = [] } = input;

      // Step 1: Search for relevant documentation using Search Agent
      const searchAgent = new SearchAgent(this.ctx);
      const searchResults = await this.callSubAgent(searchAgent, {
        query: `${query} best practices guidelines recommendations`,
        services: [service],
        categories: ["guide", "best-practices", "api-reference"],
        limit: 10,
      });

      if (!searchResults.success || !searchResults.data) {
        throw new Error("Failed to search for best practices");
      }

      // Step 2: Extract best practices using LLM
      const llm = createLLMClient({
        model: "gpt-4o-mini",
        temperature: 0.5,
        maxTokens: 2000,
      });

      const documentationContext = searchResults.data.results
        .map(
          (result, i) =>
            `[${i + 1}] ${result.title || result.sourceUrl}\n${result.text}`
        )
        .join("\n\n---\n\n");

      const extractionPrompt = `You are analyzing ${service} documentation to extract best practices.

User Query: "${query}"

${context.length > 0 ? `Additional Context:\n${context.join("\n")}\n` : ""}

Documentation Excerpts:
${documentationContext}

Extract specific best practices, guidelines, and recommendations related to the user's query.

For each best practice:
1. State the practice clearly and concisely
2. Include the source (document title or URL)
3. Rate its relevance to the query (0-10)

Return a JSON array with this format:
{
  "bestPractices": [
    {
      "practice": "Clear description of the best practice",
      "source": "Document title or URL",
      "relevance": 9
    }
  ]
}

Focus on:
- Official recommendations from the documentation
- Performance optimizations
- Security considerations
- Common pitfalls to avoid
- Recommended patterns and approaches

Return at least 3 and up to 10 best practices, ranked by relevance.`;

      const response = await llm.generateJSON<{
        bestPractices: Array<{
          practice: string;
          source: string;
          relevance: number;
        }>;
      }>([{ role: "user", content: extractionPrompt }]);

      const bestPractices = response.bestPractices || [];

      this.log(`Extracted ${bestPractices.length} best practices`);

      return {
        success: true,
        data: {
          bestPractices,
        },
      };
    } catch (error: any) {
      this.log(`Error checking best practices: ${error.message}`);
      throw error;
    }
  }
}
