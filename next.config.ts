import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000", "127.0.0.1:3000"]
    }
  },
  async rewrites() {
    return [
      {
        source: '/media/:path*',
        destination: '/api/media/:path*'
      }
    ]
  }
};

export default nextConfig;
