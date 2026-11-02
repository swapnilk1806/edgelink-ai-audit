import { Queue } from "bullmq";
import { getEnv } from "@backend/lib/env";
import { getRedisConnectionOptions } from "@backend/lib/redis-connection";

let auditQueue: Queue | undefined;

export function getAuditQueue() {
  if (!auditQueue) {
    auditQueue = new Queue("seo-audit-jobs", {
      connection: getRedisConnectionOptions(getEnv().UPSTASH_REDIS_URL)
    });
  }
  return auditQueue;
}
