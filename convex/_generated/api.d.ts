/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as authz from "../authz.js";
import type * as bookmarks from "../bookmarks.js";
import type * as chat from "../chat.js";
import type * as crons from "../crons.js";
import type * as dialecticComparisons from "../dialecticComparisons.js";
import type * as ingest from "../ingest.js";
import type * as merge from "../merge.js";
import type * as messages from "../messages.js";
import type * as philosophers from "../philosophers.js";
import type * as prompts from "../prompts.js";
import type * as rag from "../rag.js";
import type * as rateLimit from "../rateLimit.js";
import type * as seed from "../seed.js";
import type * as sourceTexts from "../sourceTexts.js";
import type * as threads from "../threads.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  authz: typeof authz;
  bookmarks: typeof bookmarks;
  chat: typeof chat;
  crons: typeof crons;
  dialecticComparisons: typeof dialecticComparisons;
  ingest: typeof ingest;
  merge: typeof merge;
  messages: typeof messages;
  philosophers: typeof philosophers;
  prompts: typeof prompts;
  rag: typeof rag;
  rateLimit: typeof rateLimit;
  seed: typeof seed;
  sourceTexts: typeof sourceTexts;
  threads: typeof threads;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
