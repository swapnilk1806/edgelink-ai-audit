import { config } from "./app";

export const redisConfig = {
  url: config.redisUrl,
  queueName: config.queueName
};

export const getRedisUrl = () => {
  if (!redisConfig.url) {
    throw new Error("REDIS_URL or UPSTASH_REDIS_URL is required");
  }
  return redisConfig.url;
};
