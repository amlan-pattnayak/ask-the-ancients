import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── Philosophers ──────────────────────────────────────────────────────────
  philosophers: defineTable({
    slug: v.string(),
    name: v.string(),
    school: v.string(),
    tradition: v.string(),
    era: v.string(),
    tagline: v.string(),
    bio: v.string(),
    avatarUrl: v.string(),
    systemPrompt: v.string(),
    greeting: v.string(),
    works: v.array(
      v.object({
        title: v.string(),
        shortTitle: v.string(),
        sourceUrl: v.string(),
      })
    ),
    isActive: v.boolean(),
    sortOrder: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_school", ["school"])
    .index("by_active", ["isActive"]),

  // ── Source Texts (RAG corpus) ─────────────────────────────────────────────
  sourceTexts: defineTable({
    philosopherId: v.id("philosophers"),
    workTitle: v.string(),
    chapterRef: v.string(),
    content: v.string(),
    embedding: v.array(v.float64()),
  })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["philosopherId"],
    })
    .index("by_philosopher", ["philosopherId"])
    .index("by_philosopher_work", ["philosopherId", "workTitle"]),

  // ── Threads ───────────────────────────────────────────────────────────────
  threads: defineTable({
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    userId: v.optional(v.string()),
    philosopherId: v.id("philosophers"),
    title: v.optional(v.string()),
    lastMessageAt: v.number(),
    messageCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_principal", ["principalType", "principalId"])
    .index("by_userId", ["userId"]),

  // ── Messages ──────────────────────────────────────────────────────────────
  messages: defineTable({
    threadId: v.id("threads"),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    citations: v.optional(
      v.array(
        v.object({
          workTitle: v.string(),
          chapterRef: v.string(),
          passage: v.string(),
          sourceTextId: v.id("sourceTexts"),
        })
      )
    ),
    createdAt: v.number(),
  }).index("by_thread", ["threadId"]),

  // ── Bookmarks ─────────────────────────────────────────────────────────────
  bookmarks: defineTable({
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    threadId: v.id("threads"),
    messageId: v.optional(v.id("messages")),
    createdAt: v.number(),
  })
    .index("by_principal", ["principalType", "principalId"])
    .index("by_principal_thread", ["principalType", "principalId", "threadId"])
    .index("by_principal_message", ["principalType", "principalId", "messageId"]),

  // ── Principal Aliases (merge lineage) ─────────────────────────────────────
  principal_aliases: defineTable({
    fromPrincipalId: v.string(),
    toPrincipalId: v.string(),
    mergedAt: v.number(),
  }).index("by_from", ["fromPrincipalId"]),

  // ── Usage Counters (rate limiting) ────────────────────────────────────────
  usage_counters: defineTable({
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    date: v.string(), // YYYY-MM-DD
    messageCount: v.number(),
    // Burst control — timestamp of the most recently accepted message.
    // Undefined for legacy rows; populated on first consume after schema deploy.
    lastMessageAt: v.optional(v.number()),
  }).index("by_principal_date", ["principalType", "principalId", "date"]),

  // ── Dialectic Comparisons (Agora history) ────────────────────────────────
  dialectic_comparisons: defineTable({
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    title: v.optional(v.string()),          // user-editable; falls back to question
    question: v.string(),
    philosopherAId: v.id("philosophers"),
    philosopherAName: v.string(),           // denormalised — survives philosopher edits
    philosopherBId: v.id("philosophers"),
    philosopherBName: v.string(),
    answerA: v.string(),
    answerB: v.string(),
    citationsA: v.array(v.object({ workTitle: v.string(), chapterRef: v.string(), passage: v.string() })),
    citationsB: v.array(v.object({ workTitle: v.string(), chapterRef: v.string(), passage: v.string() })),
    createdAt: v.number(),
  }).index("by_principal", ["principalType", "principalId"]),

  // ── Provider Settings ─────────────────────────────────────────────────────
  provider_settings: defineTable({
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    provider: v.string(),
    mode: v.union(v.literal("guest"), v.literal("byok")),
    keyStorageMode: v.union(v.literal("session"), v.literal("persistent")),
    model: v.optional(v.string()),
    customEndpoint: v.optional(v.string()),
  }).index("by_principal", ["principalType", "principalId"]),

  // ── Product Analytics Events ──────────────────────────────────────────────
  product_events: defineTable({
    eventId: v.string(),
    schemaVersion: v.number(),
    eventName: v.string(),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    sessionId: v.optional(v.string()),
    timestamp: v.number(),
    source: v.union(v.literal("client"), v.literal("server")),
    properties: v.any(),
  })
    .index("by_event_id", ["eventId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_event_timestamp", ["eventName", "timestamp"])
    .index("by_principal_timestamp", ["principalType", "principalId", "timestamp"]),

  // ── Session Analytics ─────────────────────────────────────────────────────
  sessions: defineTable({
    sessionId: v.string(),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    startedAt: v.number(),
    lastSeenAt: v.number(),
    endedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    eventCount: v.number(),
  })
    .index("by_session_id", ["sessionId"])
    .index("by_startedAt", ["startedAt"])
    .index("by_principal_startedAt", ["principalType", "principalId", "startedAt"]),

  // ── Daily KPI Rollups ─────────────────────────────────────────────────────
  daily_kpis: defineTable({
    date: v.string(), // YYYY-MM-DD
    metricName: v.string(),
    metricValue: v.float64(),
    meta: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_date_metric", ["date", "metricName"])
    .index("by_metric_date", ["metricName", "date"]),
});
