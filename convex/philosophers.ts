import { v } from "convex/values";
import { query } from "./_generated/server";

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("philosophers")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("philosophers")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});
