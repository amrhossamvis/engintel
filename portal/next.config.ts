import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["10.236.32.226"],
  serverExternalPackages: ["pg"],
  // motion isn't in Next's default optimizePackageImports list (lucide-react and
  // recharts are). Without this, Turbopack compiles the full motion barrel into
  // every animated route, ballooning dev memory.
  experimental: {
    optimizePackageImports: ["motion"],
  },
};

export default nextConfig;
