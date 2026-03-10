import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { assertPrincipalAccess } from "./authz";

function newEventId(): string {
  return crypto.randomUUID();
}

export const sendUserMessage = mutation({
  args: {
    threadId: v.id("threads"),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    content: v.string(),
    // BYOK: optional user-supplied key forwarded to the action.
    // Never stored in DB — used transiently during inference only.
    byokKey: v.optional(v.string()),
    byokModel: v.optional(v.string()),
    byokEndpoint: v.optional(v.string()),
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

    // Store user message
    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      principalType: args.principalType,
      principalId: args.principalId,
      role: "user",
      content: args.content,
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.threadId, {
      lastMessageAt: Date.now(),
      messageCount: (thread.messageCount ?? 0) + 1,
    });

    const philosopher = await ctx.db.get(thread.philosopherId);
    await ctx.db.insert("product_events", {
      eventId: newEventId(),
      schemaVersion: 1,
      eventName: "message_sent",
      principalType: args.principalType,
      principalId: args.principalId,
      timestamp: Date.now(),
      source: "server",
      properties: {
        threadId: args.threadId,
        philosopherId: thread.philosopherId,
        philosopherSlug: philosopher?.slug ?? "unknown",
        mode: args.byokKey ? "byok" : "guest",
        messageLength: args.content.length,
      },
    });

    // Schedule chat processing action (runs immediately, outside mutation)
    await ctx.scheduler.runAfter(0, internal.chat.processMessage, {
      threadId: args.threadId,
      userMessageId: messageId,
      principalType: args.principalType,
      principalId: args.principalId,
      userContent: args.content,
      byokKey: args.byokKey,
      byokModel: args.byokModel,
      byokEndpoint: args.byokEndpoint,
    });

    return messageId;
  },
});

/**
 * Stores a user message without scheduling the Convex inference action.
 * Used by the streaming API route, which handles inference externally.
 */
export const sendUserMessageOnly = mutation({
  args: {
    threadId: v.id("threads"),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    content: v.string(),
    mode: v.optional(v.union(v.literal("guest"), v.literal("byok"))),
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

    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      principalType: args.principalType,
      principalId: args.principalId,
      role: "user",
      content: args.content,
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.threadId, {
      lastMessageAt: Date.now(),
      messageCount: (thread.messageCount ?? 0) + 1,
    });

    const philosopher = await ctx.db.get(thread.philosopherId);
    await ctx.db.insert("product_events", {
      eventId: newEventId(),
      schemaVersion: 1,
      eventName: "message_sent",
      principalType: args.principalType,
      principalId: args.principalId,
      timestamp: Date.now(),
      source: "server",
      properties: {
        threadId: args.threadId,
        philosopherId: thread.philosopherId,
        philosopherSlug: philosopher?.slug ?? "unknown",
        mode: args.mode ?? "guest",
        messageLength: args.content.length,
      },
    });

    return messageId;
  },
});

/**
 * Stores a streamed assistant message (called from client after stream
 * completes). Verifies thread ownership before writing.
 */
export const storeStreamedAssistantMessage = mutation({
  args: {
    threadId: v.id("threads"),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    content: v.string(),
    mode: v.optional(v.union(v.literal("guest"), v.literal("byok"))),
    crisisDetected: v.optional(v.boolean()),
    citations: v.optional(v.array(v.object({
      workTitle: v.string(),
      chapterRef: v.string(),
      passage: v.string(),
      sourceTextId: v.id("sourceTexts"),
    }))),
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

    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      principalType: args.principalType,
      principalId: args.principalId,
      role: "assistant",
      content: args.content,
      citations: args.citations ?? [],
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.threadId, {
      lastMessageAt: Date.now(),
      messageCount: (thread.messageCount ?? 0) + 1,
    });

    const philosopher = await ctx.db.get(thread.philosopherId);
    await ctx.db.insert("product_events", {
      eventId: newEventId(),
      schemaVersion: 1,
      eventName: "assistant_response_received",
      principalType: args.principalType,
      principalId: args.principalId,
      timestamp: Date.now(),
      source: "server",
      properties: {
        threadId: args.threadId,
        messageId,
        philosopherId: thread.philosopherId,
        philosopherSlug: philosopher?.slug ?? "unknown",
        mode: args.mode ?? "byok",
        latencyMs: 0,
        citationCount: args.citations?.length ?? 0,
        responseLength: args.content.length,
        crisisDetected: args.crisisDetected ?? false,
      },
    });

    return messageId;
  },
});

export const storeAssistantMessage = internalMutation({
  args: {
    threadId: v.id("threads"),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    content: v.string(),
    citations: v.array(
      v.object({
        workTitle: v.string(),
        chapterRef: v.string(),
        passage: v.string(),
        sourceTextId: v.id("sourceTexts"),
      })
    ),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      principalType: args.principalType,
      principalId: args.principalId,
      role: "assistant",
      content: args.content,
      citations: args.citations,
      createdAt: Date.now(),
    });

    // Update thread stats
    const thread = await ctx.db.get(args.threadId);
    if (thread) {
      await ctx.db.patch(args.threadId, {
        lastMessageAt: Date.now(),
        messageCount: (thread.messageCount ?? 0) + 1,
      });
    }

    return messageId;
  },
});

export const listByThread = query({
  args: {
    threadId: v.id("threads"),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
  },
  handler: async (ctx, args) => {
    await assertPrincipalAccess(ctx, args.principalType, args.principalId);
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return [];
    if (
      thread.principalType !== args.principalType ||
      thread.principalId !== args.principalId
    ) {
      return [];
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});

// Used by internal actions (no user auth context in server-side actions).
export const listByThreadInternal = internalQuery({
  args: {
    threadId: v.id("threads"),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread) return [];
    if (
      thread.principalType !== args.principalType ||
      thread.principalId !== args.principalId
    ) {
      return [];
    }
    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();
  },
});
