import Redis from "ioredis";

/**
 * Vercel functions have a read-only filesystem (writable /tmp only, and not
 * guaranteed to survive between invocations) — verified against Vercel's own
 * docs. Both the roster (rosterStore.ts) and the owner-count snapshot
 * (ownerCounts.ts) need a real persistent store once this app runs on
 * Vercel, not just locally.
 *
 * REDIS_URL is a plain redis://user:pass@host:port connection string (Redis
 * Cloud, in this deployment) — a different protocol from Upstash's REST API,
 * so this is a standard TCP client (ioredis), not @upstash/redis. lazyConnect
 * means the app still boots without REDIS_URL set (e.g. local dev before
 * it's configured); any actual read/write just rejects with a clear error
 * instead of the whole process failing.
 *
 * Cached on globalThis (same pattern as src/lib/cache.ts) so a warm
 * serverless instance reuses one connection across invocations rather than
 * opening a fresh one per request.
 */
const g = globalThis as unknown as { __redis?: Redis };

export const redis: Redis =
  g.__redis ?? new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", { lazyConnect: true, maxRetriesPerRequest: 2 });
g.__redis = redis;

// ioredis throws (crashing the whole process) on an unhandled 'error' event —
// Node's default EventEmitter behavior. A connection failure must reject the
// in-flight get/set call, not take down the server.
if (redis.listenerCount("error") === 0) {
  redis.on("error", (err) => console.error("[redis]", err.message));
}

export async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function setJSON(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const raw = JSON.stringify(value);
  if (ttlSeconds) await redis.set(key, raw, "EX", ttlSeconds);
  else await redis.set(key, raw);
}
