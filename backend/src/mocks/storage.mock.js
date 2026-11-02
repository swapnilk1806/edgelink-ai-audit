import { stat } from "node:fs/promises";

export async function logR2Upload({ filePath, key }) {
  const file = await stat(filePath);
  console.info(JSON.stringify({ event: "mock.r2.uploaded", key, bytes: file.size, at: new Date().toISOString() }));
  return { provider: "mock-r2", status: "logged" };
}
