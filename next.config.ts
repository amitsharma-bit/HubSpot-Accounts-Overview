import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // data/dashboardDirectory.json (the team/member directory's one-time seed,
  // replacing the old data/roster.json) is read at runtime via a
  // process.cwd()-relative fs.readFile, not a static import — Next's build
  // tracer doesn't always pick that up on its own. Every API route can
  // transitively import rosterStore.ts (Overview, Data Assignment, Data
  // Reports, and Control Center all read the team/member directory), so this
  // covers the whole /api tree rather than just the /api/roster/* routes.
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/dashboardDirectory.json"],
  },
  // ioredis isn't on Next's auto-externalized package list (verified against
  // node_modules/next/dist/docs/.../serverExternalPackages.md). Without this,
  // Turbopack tries to bundle it for the server and something in ioredis's
  // internal module structure (its Pipeline class, going by the error) gets
  // mishandled as a chunk — surfaced on Vercel as every Redis-touching route
  // throwing `TypeError: Failed to parse URL from /pipeline`, while
  // /api/overview (no Redis) kept working. This opts ioredis out of bundling
  // entirely so it's resolved via plain Node `require()` at runtime instead.
  serverExternalPackages: ["ioredis"],
};

export default nextConfig;
