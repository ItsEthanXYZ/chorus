import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const insert = internalMutation({
  args: {
    embedding: v.array(v.number()),
    text: v.string(),
    service: v.string(),
    library: v.string(),
    version: v.string(),
    category: v.string(),
    sourceUrl: v.string(),
    title: v.optional(v.string()),
    chunkIndex: v.number(),
    lastUpdated: v.number(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", args);
  },
});

export const get = internalQuery({
  args: {
    id: v.id("documents"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const deleteMany = internalMutation({
  args: {
    ids: v.array(v.id("documents")),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      await ctx.db.delete(id);
    }
  },
});
