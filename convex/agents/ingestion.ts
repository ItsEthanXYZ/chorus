// Ingestion Agent
// Chunks and ingests documentation with embeddings using recursive character splitting

import { BaseAgent } from "../lib/baseAgent";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { IngestionAgentInput, IngestionAgentOutput } from "../lib/types";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { embedDocuments } from "../lib/embeddings";

/**
 * Ingestion Agent
 * Splits documents into chunks using recursive character splitting
 * Generates embeddings and stores in the database
 */
export class IngestionAgent extends BaseAgent<IngestionAgentInput, IngestionAgentOutput> {
  constructor(ctx: ActionCtx) {
    super(ctx, "ingestion");
  }

  protected async validate(input: IngestionAgentInput): Promise<void> {
    if (!input.documents || input.documents.length === 0) {
      throw new Error("At least one document is required");
    }
    if (!input.service) {
      throw new Error("Service name is required");
    }
    if (!input.library) {
      throw new Error("Library name is required");
    }
    if (!input.version) {
      throw new Error("Version is required");
    }
    if (!input.category) {
      throw new Error("Category is required");
    }
  }

  protected async run(input: IngestionAgentInput): Promise<IngestionAgentOutput> {
    this.log(`Ingesting ${input.documents.length} documents for ${input.service}`);

    try {
      const {
        documents,
        service,
        library,
        version,
        category,
        chunkSize = 1000,
        chunkOverlap = 200,
      } = input;

      // Step 1: Split documents into chunks using RecursiveCharacterTextSplitter
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap,
        separators: [
          "\n\n\n",  // Triple newlines (major sections)
          "\n\n",    // Double newlines (paragraphs)
          "\n",      // Single newlines
          ". ",      // Sentences
          "! ",
          "? ",
          " ",       // Words
          "",        // Characters
        ],
      });

      const allChunks: Array<{
        text: string;
        sourceUrl: string;
        title?: string;
        chunkIndex: number;
      }> = [];

      for (const doc of documents) {
        this.log(`Splitting document: ${doc.url}`);

        const chunks = await textSplitter.createDocuments([doc.content]);

        chunks.forEach((chunk, index) => {
          allChunks.push({
            text: chunk.pageContent,
            sourceUrl: doc.url,
            title: doc.title,
            chunkIndex: index,
          });
        });
      }

      this.log(`Created ${allChunks.length} chunks from ${documents.length} documents`);

      // Step 2: Generate embeddings for all chunks
      const texts = allChunks.map((chunk) => chunk.text);
      const embeddings = await embedDocuments(texts);

      this.log(`Generated ${embeddings.length} embeddings`);

      // Step 3: Insert chunks into database
      const documentIds: Id<"documents">[] = [];
      const currentTime = Date.now();

      // Insert in batches to avoid overwhelming the database
      const batchSize = 100;
      for (let i = 0; i < allChunks.length; i += batchSize) {
        const batchChunks = allChunks.slice(i, i + batchSize);
        const batchEmbeddings = embeddings.slice(i, i + batchSize);

        const ids = await this.ctx.runMutation(async (ctx) => {
          const insertPromises = batchChunks.map((chunk, idx) => {
            return ctx.db.insert("documents", {
              embedding: batchEmbeddings[idx],
              text: chunk.text,
              service,
              library,
              version,
              category,
              sourceUrl: chunk.sourceUrl,
              title: chunk.title,
              chunkIndex: chunk.chunkIndex,
              lastUpdated: currentTime,
            });
          });

          return Promise.all(insertPromises);
        });

        documentIds.push(...ids);

        this.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allChunks.length / batchSize)}`);
      }

      this.log(`Successfully ingested ${documentIds.length} chunks`);

      return {
        success: true,
        data: {
          documentIds,
          totalChunks: documentIds.length,
        },
      };
    } catch (error: any) {
      this.log(`Error during ingestion: ${error.message}`);
      throw error;
    }
  }
}
