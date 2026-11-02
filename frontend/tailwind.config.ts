import type { Config } from "tailwindcss";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

const config: Config = {
  content: [path.join(configDirectory, "src/**/*.{js,ts,jsx,tsx,mdx}")],
  theme: {
    extend: {
      colors: {
        ink: "#172333",
        muted: "#6d7b8b",
        brand: "#1d7a68",
        canvas: "#f4f7f8"
      },
      boxShadow: { card: "0 8px 28px rgba(27, 49, 67, 0.06)" }
    }
  },
  plugins: []
};

export default config;
