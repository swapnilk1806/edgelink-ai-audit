import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendDirectory = fileURLToPath(new URL(".", import.meta.url));
const backendDirectory = resolve(frontendDirectory, "../backend");
loadEnv({ path: resolve(backendDirectory, ".env.local") });
loadEnv({ path: resolve(backendDirectory, ".env") });
loadEnv({ path: resolve(frontendDirectory, ".env.local") });
loadEnv({ path: resolve(frontendDirectory, ".env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    cpus: 1,
    workerThreads: false,
    externalDir: true,
    serverComponentsExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "bullmq"],
    serverActions: { bodySizeLimit: "1mb" }
  }
};

export default nextConfig;
