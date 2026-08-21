/**
 * ponytail: process-memory TTL cache, single local user only. If this ever needs
 * to survive across processes or serve more than one user, this is where a real
 * cache (Redis) or a DB goes.
 */

type Entry<T> = { value: T; expiresAt: number };

const store: Map<string, Entry<unknown>> = ((globalThis as unknown as { __cacheStore?: Map<string, Entry<unknown>> }).__cacheStore ??=
  new Map());

export async function cached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await compute();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function invalidate(key: string): void {
  store.delete(key);
}
