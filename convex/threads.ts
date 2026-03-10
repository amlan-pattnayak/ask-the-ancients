import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { assertPrincipalAccess } from "./authz";

export const create = mutation({
  args: {
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    philosopherId: v.id("philosophers"),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertPrincipalAccess(ctx, args.principalType, args.principalId);
    const now = Date.now();
    return await ctx.db.insert("threads", {
      principalType: args.principalType,
      principalId: args.principalId,
      userId: args.principalType === "user" ? args.principalId : undefined,
      philosopherId: args.philosopherId,
      title: args.title,
      lastMessageAt: now,
      messageCount: 0,
      createdAt: now,
    });
  },
});

export const getById = query({
  args: {
    threadId: v.id("threads"),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertPrincipalAccess(ctx, args.principalType, args.principalId);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return null;
    if (
      thread.principalType !== args.principalType ||
      thread.principalId !== args.principalId
    ) {
      return null;
    }
    return thread;
  },
});

// Used by internal actions (no user auth context in server-side actions).
// Ownership is verified structurally — principalType + principalId must match.
export const getByIdInternal = internalQuery({
  args: {
    threadId: v.id("threads"),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return null;
    if (
      thread.principalType !== args.principalType ||
      thread.principalId !== args.principalId
    ) {
      return null;
    }
    return thread;
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
      .query("threads")
      .withIndex("by_principal", (q) =>
        q.eq("principalType", args.principalType).eq("principalId", args.principalId)
      )
      .order("desc")
      .collect();
  },
});

export const deleteThread = mutation({
  args: {
    threadId: v.id("threads"),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertPrincipalAccess(ctx, args.principalType, args.principalId);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (
      thread.principalType !== args.principalType ||
      thread.principalId !== args.principalId
    ) {
      throw new Error("Unauthorized thread access");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_principal_thread", (q) =>
        q
          .eq("principalType", args.principalType)
          .eq("principalId", args.principalId)
          .eq("threadId", args.threadId)
      )
      .collect();
    for (const bookmark of bookmarks) {
      await ctx.db.delete(bookmark._id);
    }

    await ctx.db.delete(args.threadId);
    return { deleted: true };
  },
});

/**
 * Creates a thread pre-seeded with one user message and one assistant reply.
 * Used by the Dialectic comparison feature to bootstrap a continuation chat
 * from a comparison result without requiring a fresh inference call.
 */
export const createWithSeed = mutation({
  args: {
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    philosopherId: v.id("philosophers"),
    title: v.optional(v.string()),
    seedUserMessage: v.string(),
    seedAssistantMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await assertPrincipalAccess(ctx, args.principalType, args.principalId);
    const now = Date.now();
    const threadId = await ctx.db.insert("threads", {
      principalType: args.principalType,
      principalId: args.principalId,
      userId: args.principalType === "user" ? args.principalId : undefined,
      philosopherId: args.philosopherId,
      title: args.title,
      lastMessageAt: now,
      messageCount: 2,
      createdAt: now,
    });

    await ctx.db.insert("messages", {
      threadId,
      principalType: args.principalType,
      principalId: args.principalId,
      role: "user",
      content: args.seedUserMessage,
      createdAt: now,
    });

    await ctx.db.insert("messages", {
      threadId,
      principalType: args.principalType,
      principalId: args.principalId,
      role: "assistant",
      content: args.seedAssistantMessage,
      citations: [],
      createdAt: now + 1,
    });

    return threadId;
  },
});

export const renameThread = mutation({
  args: {
    threadId: v.id("threads"),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await assertPrincipalAccess(ctx, args.principalType, args.principalId);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new Error("Thread not found");
    if (
      thread.principalType !== args.principalType ||
      thread.principalId !== args.principalId
    ) {
      throw new Error("Unauthorized thread access");
    }

    const trimmed = args.title.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      throw new Error("Title cannot be empty");
    }

    await ctx.db.patch(args.threadId, {
      title: trimmed.slice(0, 120),
    });
    return { renamed: true };
  },
});
