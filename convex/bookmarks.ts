import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertPrincipalAccess } from "./authz";

export const listByPrincipal = query({
  args: {
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertPrincipalAccess(ctx, args.principalType, args.principalId);
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_principal", (q) =>
        q.eq("principalType", args.principalType).eq("principalId", args.principalId)
      )
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      bookmarks.map(async (bookmark) => {
        const message = bookmark.messageId ? await ctx.db.get(bookmark.messageId) : null;
        const thread = await ctx.db.get(bookmark.threadId);
        const philosopher = thread ? await ctx.db.get(thread.philosopherId) : null;
        return { bookmark, message, thread, philosopher };
      })
    );

    return enriched;
  },
});

export const listByThread = query({
  args: {
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    await assertPrincipalAccess(ctx, args.principalType, args.principalId);
    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_principal_thread", (q) =>
        q
          .eq("principalType", args.principalType)
          .eq("principalId", args.principalId)
          .eq("threadId", args.threadId)
      )
      .collect();
    return bookmarks;
  },
});

export const toggle = mutation({
  args: {
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    threadId: v.id("threads"),
    messageId: v.id("messages"),
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

    const message = await ctx.db.get(args.messageId);
    if (!message || message.threadId !== args.threadId) {
      throw new Error("Message not found in thread");
    }
    if (message.role !== "assistant") {
      throw new Error("Only assistant messages can be bookmarked");
    }

    const existing = await ctx.db
      .query("bookmarks")
      .withIndex("by_principal_message", (q) =>
        q
          .eq("principalType", args.principalType)
          .eq("principalId", args.principalId)
          .eq("messageId", args.messageId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { removed: true };
    }

    const id = await ctx.db.insert("bookmarks", {
      principalType: args.principalType,
      principalId: args.principalId,
      threadId: args.threadId,
      messageId: args.messageId,
      createdAt: Date.now(),
    });
    return { inserted: true, id };
  },
});
