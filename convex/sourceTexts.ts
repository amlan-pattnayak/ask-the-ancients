import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export const getById = internalQuery({
  args: { id: v.id("sourceTexts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
