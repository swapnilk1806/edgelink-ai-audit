import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import * as cheerio from "cheerio";

type CrawlData = {
  url: string; title: string; metaDescription: string; headings: Record<string, string[]>;
  images: { total: number; missingAlt: number }; links: { internal: number; external: number };
  canonical: string | null; schemaTypes: string[]; schemaValidation: { scriptCount: number; invalidJson: number; missingSchemaContextOrType: number };
  robotsTxt: string | null; sitemapAvailable: boolean;
};

export class WebsiteAccessError extends Error {
  constructor(readonly status: number) {
    super(
      `Website denied crawler access (HTTP ${status}). Confirm the site is publicly accessible from the worker or ask its administrator to allow the audit crawler.`
    );
    this.name = "WebsiteAccessError";
  }
}

export class WebsiteResolutionError extends Error {
  constructor() {
    super("Website hostname could not be resolved. Verify the client website URL is a real, publicly reachable domain.");
    this.name = "WebsiteResolutionError";
  }
}

export class WebsiteTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`The website did not respond within ${Math.round(timeoutMs / 1000)} seconds. Verify it is online and try the audit again.`);
    this.name = "WebsiteTimeoutError";
  }
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function isPrivateAddress(address: string) {
  const lower = address.toLowerCase();
  if (lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:")) return true;
  if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
  const parts = lower.split(".").map(Number);
  return parts.length === 4 && (parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168));
}

async function assertPublicHttpUrl(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS website URLs are supported");
  if (url.username || url.password) throw new Error("URLs with embedded credentials are not allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw new Error("Private network hosts are not allowed");
  let addresses: Awaited<ReturnType<typeof lookup>> | { address: string }[];
  try {
    addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOTFOUND") {
      throw new WebsiteResolutionError();
    }
    throw error;
  }
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("Private network hosts are not allowed");
}

const websiteRequestTimeoutMs = 30000;

async function safeFetch(target: URL, timeout = websiteRequestTimeoutMs): Promise<Response> {
  let url = target;
  for (let attempt = 0; attempt <= 4; attempt++) {
    await assertPublicHttpUrl(url);
    const signal = AbortSignal.timeout(timeout);
    let response: Response;
    try {
      response = await fetch(url, { redirect: "manual", signal, headers: { "user-agent": "EdgelinkSEOAudit/1.0 (+https://edgelink.example)" } });
    } catch (error) {
      if (signal.aborted || isTimeoutError(error)) throw new WebsiteTimeoutError(timeout);
      throw error;
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location || attempt === 4) throw new Error("Website redirected too many times");
    url = new URL(location, url);
  }
  throw new Error("Unable to fetch website");
}

async function readTextLimited(response: Response, maxBytes: number, timeout = websiteRequestTimeoutMs): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let result = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`Website response exceeds the ${maxBytes}-byte limit`);
      }
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } catch (error) {
    if (isTimeoutError(error)) throw new WebsiteTimeoutError(timeout);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function crawlWebsite(rawUrl: string): Promise<CrawlData> {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("Enter a valid website URL"); }
  const response = await safeFetch(url);
  if (response.status === 401 || response.status === 403) throw new WebsiteAccessError(response.status);
  if (!response.ok) throw new Error(`Website returned HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) throw new Error("Website did not return an HTML page");
  const html = await readTextLimited(response, 3_000_000);
  const $ = cheerio.load(html);
  const canonicalHref = $('link[rel="canonical"]').first().attr("href");
  const headings: Record<string, string[]> = {};
  for (const tag of ["h1", "h2", "h3", "h4", "h5", "h6"]) headings[tag] = $(tag).map((_, el) => $(el).text().trim()).get();
  let internal = 0;
  let external = 0;
  $("a[href]").each((_, el) => {
    try { new URL($(el).attr("href")!, url).hostname === url.hostname ? internal++ : external++; } catch { /* Ignore non-URL link values. */ }
  });
  const schemaTypes = new Set<string>();
  const schemaValidation = { scriptCount: $('script[type="application/ld+json"]').length, invalidJson: 0, missingSchemaContextOrType: 0 };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data: unknown = JSON.parse($(el).contents().text());
      const roots = Array.isArray(data) ? data : [data];
      const hasSchemaRoot = roots.some((root) => {
        if (!root || typeof root !== "object") return false;
        const item = root as Record<string, unknown>;
        const context = item["@context"];
        return typeof context === "string" && context.includes("schema.org") && Boolean(item["@type"]);
      });
      if (!hasSchemaRoot) schemaValidation.missingSchemaContextOrType++;
      const collect = (value: unknown) => {
        if (value && typeof value === "object") {
          const item = value as Record<string, unknown>;
          const type = item["@type"];
          if (typeof type === "string") schemaTypes.add(type);
          if (Array.isArray(type)) type.filter((entry): entry is string => typeof entry === "string").forEach((entry) => schemaTypes.add(entry));
          Object.values(item).forEach(collect);
        } else if (Array.isArray(value)) value.forEach(collect);
      };
      collect(data);
    } catch { schemaValidation.invalidJson++; }
  });
  const origin = url.origin;
  let robotsTxt: string | null = null;
  let sitemapAvailable = false;
  try {
    const robots = await safeFetch(new URL("/robots.txt", origin), 5000);
    if (robots.ok) {
      robotsTxt = await readTextLimited(robots, 100000);
      sitemapAvailable = /(?:^|\n)\s*sitemap\s*:/i.test(robotsTxt);
    }
  } catch { robotsTxt = null; }
  if (!sitemapAvailable) {
    try { sitemapAvailable = (await safeFetch(new URL("/sitemap.xml", origin), 5000)).ok; } catch { sitemapAvailable = false; }
  }
  return {
    url: url.toString(),
    title: $("title").first().text().trim(),
    metaDescription: $('meta[name="description"]').attr("content")?.trim() || "",
    headings,
    images: { total: $("img").length, missingAlt: $("img").filter((_, el) => !$(el).attr("alt")?.trim()).length },
    links: { internal, external },
    canonical: canonicalHref ? new URL(canonicalHref, url).toString() : null,
    schemaTypes: [...schemaTypes],
    schemaValidation,
    robotsTxt,
    sitemapAvailable
  };
}
