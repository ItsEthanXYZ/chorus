"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { embedDocuments, embedQuery } from "./lib/embeddings";

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
    const vectors = await embedDocuments(args.documents.map((doc) => doc.text));

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
    filter: v.optional(
      v.object({
        category: v.optional(v.string()),
        source: v.optional(v.string()),
        title: v.optional(v.string()),
        chunkIndex: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const queryVector = await embedQuery(args.query);

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
