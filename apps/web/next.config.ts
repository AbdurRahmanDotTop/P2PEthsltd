import type { NextConfig } from "next";

const nextConfig: any = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ["@ethsltd/api-client", "@ethsltd/types"],
  serverExternalPackages: ["sharp"],
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://p2p-api.ethsltd.workers.dev'}/api/v1/:path*`
      }
    ];
  },
};

export default nextConfig;
