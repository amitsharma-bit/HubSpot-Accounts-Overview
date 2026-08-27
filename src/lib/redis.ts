import { Redis } from "@upstash/redis";

/**
 * Vercel functions have a read-only filesystem (writable /tmp only, and not
 * guaranteed to survive between invocations) — verified against Vercel's own
 * docs. Both the roster (rosterStore.ts) and the owner-count snapshot
 * (ownerCounts.ts) need a real persistent store once this app runs on
 * Vercel, not just locally. Redis.fromEnv() reads KV_REST_API_URL/TOKEN
 * (what the Vercel Marketplace "Redis" integration injects — Vercel KV
 * itself is deprecated in favor of this) or UPSTASH_REDIS_REST_URL/TOKEN
 * (a direct Upstash account) automatically, so either provisioning path works
 * with zero code changes.
 */
export const redis = Redis.fromEnv();
