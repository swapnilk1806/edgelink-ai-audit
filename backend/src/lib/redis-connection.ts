export function getRedisConnectionOptions(connectionUrl: string) {
  let url: URL;
  try {
    url = new URL(connectionUrl);
  } catch {
    throw new Error("UPSTASH_REDIS_URL is missing or malformed. Use the Upstash Redis TCP URL from the database Connect page.");
  }

  if (!["redis:", "rediss:"].includes(url.protocol) || !url.hostname) {
    throw new Error(
      "UPSTASH_REDIS_URL must be a Redis TCP URL (rediss://... or redis://...). Do not use the HTTPS REST URL or REST token."
    );
  }

  const port = url.port ? Number(url.port) : 6379;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("UPSTASH_REDIS_URL must include a valid Redis TCP port, usually 6379.");
  }

  return {
    host: url.hostname,
    port,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null
  };
}
