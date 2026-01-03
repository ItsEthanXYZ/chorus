// Multi-LLM client abstraction
// Supports OpenAI and other providers through a unified interface

import { ChatOpenAI } from "@langchain/openai";
import type { LLMMessage, LLMOptions } from "./types";

/**
 * Multi-LLM client that abstracts different LLM providers
 * Currently supports OpenAI, can be extended for Anthropic, etc.
 */
export class MultiLLMClient {
  private provider: "openai" | "anthropic";
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(options: LLMOptions = {}) {
    this.provider = options.provider || "openai";
    this.model = options.model || this.getDefaultModel();
    this.temperature = options.temperature ?? 0.7;
    this.maxTokens = options.maxTokens ?? 2000;
  }

  private getDefaultModel(): string {
    switch (this.provider) {
      case "openai":
        return "gpt-4o-mini";
      case "anthropic":
        return "claude-3-5-sonnet-20241022";
      default:
        return "gpt-4o-mini";
    }
  }

  /**
   * Generate a completion from messages
   */
  async chat(messages: LLMMessage[]): Promise<string> {
    switch (this.provider) {
      case "openai":
        return this.chatOpenAI(messages);
      case "anthropic":
        return this.chatAnthropic(messages);
      default:
        throw new Error(`Unsupported LLM provider: ${this.provider}`);
    }
  }

  private async chatOpenAI(messages: LLMMessage[]): Promise<string> {
    const llm = new ChatOpenAI({
      modelName: this.model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });

    const langchainMessages = messages.map((msg) => {
      const content = msg.content;
      switch (msg.role) {
        case "system":
          return { role: "system" as const, content };
        case "user":
          return { role: "user" as const, content };
        case "assistant":
          return { role: "assistant" as const, content };
        default:
          return { role: "user" as const, content };
      }
    });

    const response = await llm.invoke(langchainMessages);
    return response.content.toString();
  }

  private async chatAnthropic(messages: LLMMessage[]): Promise<string> {
    // Placeholder for Anthropic implementation
    // When @anthropic-ai/sdk is available, implement this method
    // For now, fall back to OpenAI
    console.warn("Anthropic provider not yet implemented, falling back to OpenAI");
    return this.chatOpenAI(messages);
  }

  /**
   * Generate structured JSON output
   */
  async generateJSON<T = any>(
    messages: LLMMessage[],
    schema?: string
  ): Promise<T> {
    const systemMessage: LLMMessage = {
      role: "system",
      content: `You are a helpful assistant that responds with valid JSON only. ${
        schema ? `Follow this schema: ${schema}` : ""
      }`,
    };

    const response = await this.chat([systemMessage, ...messages]);

    // Extract JSON from response (handle code blocks)
    const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response;

    try {
      return JSON.parse(jsonStr.trim());
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${error}`);
    }
  }

  /**
   * Analyze text and return a score/rating
   */
  async score(
    text: string,
    criteria: string,
    minScore: number = 0,
    maxScore: number = 10
  ): Promise<number> {
    const messages: LLMMessage[] = [
      {
        role: "system",
        content: `You are an expert evaluator. Rate the following text based on: ${criteria}. Respond with ONLY a number between ${minScore} and ${maxScore}.`,
      },
      {
        role: "user",
        content: text,
      },
    ];

    const response = await this.chat(messages);
    const score = parseFloat(response.trim());

    if (isNaN(score) || score < minScore || score > maxScore) {
      throw new Error(`Invalid score received: ${response}`);
    }

    return score;
  }

  /**
   * Summarize text
   */
  async summarize(text: string, maxLength?: number): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: "system",
        content: `You are a helpful assistant that creates concise summaries.${
          maxLength ? ` Keep summaries under ${maxLength} characters.` : ""
        }`,
      },
      {
        role: "user",
        content: `Summarize the following text:\n\n${text}`,
      },
    ];

    return this.chat(messages);
  }

  /**
   * Extract structured information from text
   */
  async extract(
    text: string,
    extractionPrompt: string
  ): Promise<string> {
    const messages: LLMMessage[] = [
      {
        role: "system",
        content: "You are a helpful assistant that extracts specific information from text.",
      },
      {
        role: "user",
        content: `${extractionPrompt}\n\nText:\n${text}`,
      },
    ];

    return this.chat(messages);
  }
}

/**
 * Create a new LLM client instance
 */
export function createLLMClient(options?: LLMOptions): MultiLLMClient {
  return new MultiLLMClient(options);
}
