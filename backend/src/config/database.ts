import { config } from "./app";

export const databaseConfig = {
  url: config.databaseUrl,
  ssl: process.env.DATABASE_SSL ?? "auto"
};

export const getDatabaseUrl = () => {
  if (!databaseConfig.url) {
    throw new Error("DATABASE_URL is required");
  }
  return databaseConfig.url;
};
