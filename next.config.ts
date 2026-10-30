import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'mongodb', 'mysql2'],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000", "127.0.0.1:3000", "192.168.*:3000", "10.*:3000", "172.*:3000",
        "localhost:3015", "127.0.0.1:3015", "192.168.*:3015", "10.*:3015", "172.*:3015",
        "localhost:3030", "127.0.0.1:3030", "192.168.*:3030", "10.*:3030", "172.*:3030"
      ]
    }
  },
  async rewrites() {
    return [
      {
        source: '/media/:path*',
        destination: '/api/media/:path*'
      }
    ]
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ]
  }
};

export default nextConfig;
