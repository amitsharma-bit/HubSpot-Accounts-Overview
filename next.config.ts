import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // data/roster.json is read at runtime (as the one-time seed for a fresh
  // Redis store) via a process.cwd()-relative fs.readFile, not a static
  // import — Next's build tracer doesn't always pick that up on its own, so
  // it's listed explicitly to guarantee it ships in the serverless bundle.
  outputFileTracingIncludes: {
    "/api/roster": ["./data/roster.json"],
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
