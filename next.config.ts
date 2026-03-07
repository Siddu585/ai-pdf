import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.NEXT_PUBLIC_IS_MOBILE === 'true' ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
