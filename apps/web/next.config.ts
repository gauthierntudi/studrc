import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.egouv.online",
      },
      {
        protocol: "https",
        hostname: "cdn.opt1mum.com",
      },
    ],
  },
};

export default nextConfig;
