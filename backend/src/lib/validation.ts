import { z } from "zod";

export const websiteUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Website URL must use HTTP or HTTPS");
