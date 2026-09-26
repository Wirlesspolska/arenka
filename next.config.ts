import type { NextConfig } from "next";

const tileOrigin = process.env.TILE_ORIGIN || "https://maps.tcno.co";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/tcno/:path*",
        destination: `${tileOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
