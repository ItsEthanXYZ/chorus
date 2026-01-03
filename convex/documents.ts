"use node";
import { OpenAIEmbeddings } from "@langchain/openai";
import { internalAction } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v } from "convex/values";
import { env } from "./env.js";

export const ingest = internalAction({
  args: {
    documents: v.array(
      v.object({
        text: v.string(),
        metadata: v.optional(v.any()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
      apiKey: env.OPEN_AI_API_KEY,
    });

    const texts = args.documents.map((doc) => doc.text);
    const vectors = await embeddings.embedDocuments(texts);

    const insertedIds: any[] = await Promise.all(
      args.documents.map(async (doc, index): Promise<any> => {
        const vector = vectors[index];
        if (!vector) {
          throw new Error(
            `Missing embedding vector for document at index ${index}`,
          );
        }
        return await ctx.runMutation(internal.model.documents.insert, {
          embedding: vector,
          text: doc.text,
          metadata: doc.metadata ?? {},
        });
      }),
    );

    return { count: insertedIds.length, ids: insertedIds };
  },
});

export const search = internalAction({
  args: {
    query: v.string(),
    filter: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
      apiKey: env.OPEN_AI_API_KEY,
    });
    const queryVector = await embeddings.embedQuery(args.query);

    const searchOptions: any = {
      vector: queryVector,
      limit: 16,
    };

    if (args.filter && Object.keys(args.filter).length > 0) {
      searchOptions.filter = (q: any) => {
        let filterQuery = q;
        for (const [key, value] of Object.entries(args.filter!)) {
          filterQuery = filterQuery.eq(`metadata.${key}`, value);
        }
        return filterQuery;
      };
    }

    const results = await ctx.vectorSearch(
      "documents",
      "byEmbedding",
      searchOptions,
    );

    const documentsWithScores: Array<any> = await Promise.all(
      results.map(async (result): Promise<any> => {
        const doc: any = await ctx.runQuery(internal.model.documents.get, {
          id: result._id,
        });
        return {
          _id: doc._id,
          _score: result._score,
          text: doc.text,
          metadata: doc.metadata,
        };
      }),
    );

    return documentsWithScores;
  },
});
