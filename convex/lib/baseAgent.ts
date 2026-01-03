// Base agent class for all specialized agents

import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { AgentType, AgentStatus, BaseAgentInput, BaseAgentOutput } from "./types";

/**
 * Base class for all agents
 * Provides common functionality like logging, error handling, and state management
 */
export abstract class BaseAgent<TInput extends BaseAgentInput, TOutput extends BaseAgentOutput> {
  protected ctx: ActionCtx;
  protected agentType: AgentType;
  protected logId?: Id<"agentLogs">;

  constructor(ctx: ActionCtx, agentType: AgentType) {
    this.ctx = ctx;
    this.agentType = agentType;
  }

  /**
   * Execute the agent
   */
  async execute(input: TInput): Promise<TOutput> {
    const startTime = Date.now();

    try {
      // Create agent log
      this.logId = await this.createLog(input, "running", startTime);

      // Validate input
      await this.validate(input);

      // Execute the agent's specific logic
      const output = await this.run(input);

      // Update log with success
      await this.updateLog(this.logId, "completed", output, undefined, Date.now());

      return output;
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error occurred";

      // Update log with failure
      if (this.logId) {
        await this.updateLog(this.logId, "failed", undefined, errorMessage, Date.now());
      }

      // Return error output
      return {
        success: false,
        error: errorMessage,
      } as TOutput;
    }
  }

  /**
   * Abstract method that each agent must implement
   */
  protected abstract run(input: TInput): Promise<TOutput>;

  /**
   * Validate agent input (override if needed)
   */
  protected async validate(input: TInput): Promise<void> {
    // Base validation can be added here
    // Subclasses can override to add specific validation
  }

  /**
   * Create an agent log entry
   */
  private async createLog(
    input: TInput,
    status: AgentStatus,
    startTime: number
  ): Promise<Id<"agentLogs">> {
    return await this.ctx.runMutation(
      (ctx) => {
        return ctx.db.insert("agentLogs", {
          agentType: this.agentType,
          service: input.service,
          status,
          startTime,
          input,
        });
      }
    );
  }

  /**
   * Update an agent log entry
   */
  private async updateLog(
    logId: Id<"agentLogs">,
    status: AgentStatus,
    output?: any,
    error?: string,
    endTime?: number
  ): Promise<void> {
    await this.ctx.runMutation(
      (ctx) => {
        return ctx.db.patch(logId, {
          status,
          output,
          error,
          endTime,
        });
      }
    );
  }

  /**
   * Log a message (for debugging)
   */
  protected log(message: string, data?: any): void {
    console.log(`[${this.agentType}] ${message}`, data || "");
  }

  /**
   * Call another agent as a subagent
   */
  protected async callSubAgent<TSubInput extends BaseAgentInput, TSubOutput extends BaseAgentOutput>(
    agent: BaseAgent<TSubInput, TSubOutput>,
    input: TSubInput
  ): Promise<TSubOutput> {
    this.log(`Calling subagent: ${agent.agentType}`);
    return await agent.execute(input);
  }
}
