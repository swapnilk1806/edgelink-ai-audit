import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },
  serverExternalPackages: [
    "bullmq",
    "@sparticuz/chromium",
  ],
};

export default nextConfig;