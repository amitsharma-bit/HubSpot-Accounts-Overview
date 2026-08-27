/**
 * ponytail: process-memory TTL cache, single local user only. If this ever needs
 * to survive across processes or serve more than one user, this is where a real
 * cache (Redis) or a DB goes.
 *
 * Caches the in-flight PROMISE, not just the resolved value — several
 * components (SummaryCards, TeamCards, RoleDistribution, MemberTable) mount
 * at once and request the same key (e.g. the default-scope owner-count
 * sweep) before any of them has resolved. Caching only the resolved value
 * let every one of those concurrent callers kick off its own duplicate ~75s
 * sweep, multiplying load on the shared HubSpot rate gate — caught live via
 * a /api/validate call that stalled for minutes under ordinary browser use.
 */

type Entry<T> = { promise: Promise<T>; expiresAt: number };

const store: Map<string, Entry<unknown>> = ((globalThis as unknown as { __cacheStore?: Map<string, Entry<unknown>> }).__cacheStore ??=
  new Map());

export async function cached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > Date.now()) return hit.promise;
  const promise = compute();
  store.set(key, { promise, expiresAt: Date.now() + ttlMs });
  // A failed compute must not poison the cache with a permanently-rejecting
  // promise — clear it so the next call retries instead of failing forever.
  promise.catch(() => store.delete(key));
  return promise;
}

export function invalidate(key: string): void {
  store.delete(key);
}
