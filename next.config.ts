import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output: `next build` emits a self-contained .next/standalone
  // server (its own minimal node_modules) that the Docker runner stage copies.
  // This is what makes the production image small and lets it start with
  // `node server.js` instead of the full `next start` toolchain.
  output: "standalone",

  // Deterministic money logic lives in lib/ and is unit-tested in isolation.
  // Keep server-only packages out of the client bundle here as they are added.
  experimental: {},
};

export default nextConfig;
