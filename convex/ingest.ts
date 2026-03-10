import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const batchInsert = mutation({
  args: {
    chunks: v.array(
      v.object({
        philosopherId: v.id("philosophers"),
        workTitle: v.string(),
        chapterRef: v.string(),
        content: v.string(),
        embedding: v.array(v.float64()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const chunk of args.chunks) {
      const id = await ctx.db.insert("sourceTexts", chunk);
      ids.push(id);
    }
    return { inserted: ids.length };
  },
});

export const clearAll = mutation({
  args: { philosopherId: v.id("philosophers") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sourceTexts")
      .withIndex("by_philosopher", (q) => q.eq("philosopherId", args.philosopherId))
      .collect();
    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: existing.length };
  },
});

export const clearByWork = mutation({
  args: {
    philosopherId: v.id("philosophers"),
    workTitle: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sourceTexts")
      .withIndex("by_philosopher_work", (q) =>
        q.eq("philosopherId", args.philosopherId).eq("workTitle", args.workTitle)
      )
      .collect();

    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }

    return { deleted: existing.length };
  },
});
