import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Deterministic money logic lives in lib/ and is unit-tested in isolation.
  // Keep server-only packages out of the client bundle here as they are added.
  experimental: {},
};

export default nextConfig;
