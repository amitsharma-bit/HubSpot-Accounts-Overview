import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // data/roster.json is read at runtime (as the one-time seed for a fresh
  // Redis store) via a process.cwd()-relative fs.readFile, not a static
  // import — Next's build tracer doesn't always pick that up on its own, so
  // it's listed explicitly to guarantee it ships in the serverless bundle.
  outputFileTracingIncludes: {
    "/api/roster": ["./data/roster.json"],
  },
};

export default nextConfig;
