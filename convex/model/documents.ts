import { internalMutation, internalQuery } from "../_generated/server.js";
import { v } from "convex/values";

export const insert = internalMutation({
  args: {
    embedding: v.array(v.number()),
    text: v.string(),
    metadata: v.any(),
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
