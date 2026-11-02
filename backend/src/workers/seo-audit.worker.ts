import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function startWorker() {
  const [{ Worker, UnrecoverableError }, { getEnv }, { getRedisConnectionOptions }, { runAudit }, { WebsiteAccessError }] = await Promise.all([
    import("bullmq"),
    import("@backend/lib/env"),
    import("@backend/lib/redis-connection"),
    import("@backend/lib/audit-runner"),
    import("@backend/lib/crawler")
  ]);

  const redisOptions = getRedisConnectionOptions(getEnv().UPSTASH_REDIS_URL);
  const worker = new Worker("seo-audit-jobs", async (job) => {
    await job.updateProgress(0);
    try {
      await runAudit(job.data.auditId as string, (value) => job.updateProgress(value));
    } catch (error) {
      if (error instanceof WebsiteAccessError) throw new UnrecoverableError(error.message);
      throw error;
    }
  }, {
    connection: redisOptions,
    concurrency: 2
  });

  worker.on("completed", (job) => console.info(`Audit job ${job.id} completed`));
  worker.on("failed", (job, error) => console.error(`Audit job ${job?.id ?? "unknown"} failed`, error));
  worker.on("error", (error) => console.error("SEO audit worker error", error));
  console.info("SEO audit worker listening on seo-audit-jobs");
}

void startWorker().catch((error: unknown) => {
  console.error("Failed to start SEO audit worker", error);
  process.exitCode = 1;
});
