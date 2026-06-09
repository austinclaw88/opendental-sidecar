import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Proxy /api/* to the backend.
  // In Docker: API_PROXY_TARGET=http://backend:8080
  // In dev (no Docker): set API_PROXY_TARGET=http://localhost:5000 in .env.local
  async rewrites() {
    const target = process.env.API_PROXY_TARGET || "http://localhost:5000";
    return [
      {
        source: "/api/:path*",
        destination: `${target}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
