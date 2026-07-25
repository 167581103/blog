import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "X-DNS-Prefetch-Control",
          value: "on",
        },
      ],
    },
    {
      source: "/articles/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "private, no-cache, must-revalidate",
        },
      ],
    },
  ],
};

export default nextConfig;
