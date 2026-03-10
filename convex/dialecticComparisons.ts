import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertPrincipalAccess } from "./authz";

const citationObject = v.object({
  workTitle: v.string(),
  chapterRef: v.string(),
  passage: v.string(),
});

export const save = mutation({
  args: {
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    question: v.string(),
    philosopherAId: v.id("philosophers"),
    philosopherAName: v.string(),
    philosopherBId: v.id("philosophers"),
    philosopherBName: v.string(),
    answerA: v.string(),
    answerB: v.string(),
    citationsA: v.array(citationObject),
    citationsB: v.array(citationObject),
  },
  handler: async (ctx, args) => {
    await assertPrincipalAccess(ctx, args.principalType, args.principalId);
    return await ctx.db.insert("dialectic_comparisons", {
      principalType: args.principalType,
      principalId: args.principalId,
      question: args.question,
      philosopherAId: args.philosopherAId,
      philosopherAName: args.philosopherAName,
      philosopherBId: args.philosopherBId,
      philosopherBName: args.philosopherBName,
      answerA: args.answerA,
      answerB: args.answerB,
      citationsA: args.citationsA,
      citationsB: args.citationsB,
      createdAt: Date.now(),
    });
  },
});

export const rename = mutation({
  args: {
    comparisonId: v.id("dialectic_comparisons"),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await assertPrincipalAccess(ctx, args.principalType, args.principalId);
    const doc = await ctx.db.get(args.comparisonId);
    if (!doc) throw new Error("Comparison not found.");
    if (doc.principalType !== args.principalType || doc.principalId !== args.principalId) {
      throw new Error("Unauthorized.");
    }
    const trimmed = args.title.trim().replace(/\s+/g, " ").slice(0, 140);
    if (!trimmed) throw new Error("Title cannot be empty.");
    await ctx.db.patch(args.comparisonId, { title: trimmed });
    return { renamed: true };
  },
});

export const remove = mutation({
  args: {
    comparisonId: v.id("dialectic_comparisons"),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertPrincipalAccess(ctx, args.principalType, args.principalId);
    const doc = await ctx.db.get(args.comparisonId);
    if (!doc) throw new Error("Comparison not found.");
    if (doc.principalType !== args.principalType || doc.principalId !== args.principalId) {
      throw new Error("Unauthorized.");
    }
    await ctx.db.delete(args.comparisonId);
    return { deleted: true };
  },
});

export const listByPrincipal = query({
  args: {
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertPrincipalAccess(ctx, args.principalType, args.principalId);
    return await ctx.db
      .query("dialectic_comparisons")
      .withIndex("by_principal", (q) =>
        q.eq("principalType", args.principalType).eq("principalId", args.principalId)
      )
      .order("desc")
      .collect();
  },
});
