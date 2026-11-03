import { auditResultSchema, type AuditResult } from "@backend/lib/audit-schema";
import { useMocks } from "@backend/lib/env";

const masterPrompt = `You are a senior SEO analyst with 15+ years of experience specialising in Indian local business websites, healthcare, dental, and real estate sectors. Produce honest, falsifiable, prioritised SEO audit reports. Return valid JSON only, with no markdown or preamble.

Use only evidence present in the supplied data. Do not invent business details, measurements, or findings. The audited URL is the only site being scored. Mock signals apply only when mock_data.applies_to_audited_host is true; when false, do not use sample PageSpeed, GSC, or keyword data in the score, findings, recommendations, or summary. Never attribute metrics or URLs from another host to the audited site. If a signal is absent or not applicable, say so in the summary rather than treating it as a failure.

Return exactly this JSON structure:
{
  "audit_version": "v1.0",
  "overall_score": 0,
  "score_breakdown": {
    "technical": 0,
    "on_page": 0,
    "content": 0,
    "core_web_vitals": 0,
    "schema": 0
  },
  "critical_issues": ["Concise issue description"],
  "important_issues": ["Concise issue description"],
  "quick_wins": ["Concise action that can be completed in two hours or less"],
  "recommendations": [{
    "priority": "CRITICAL|HIGH|MEDIUM|LOW",
    "category": "Technical|OnPage|Content|Schema|CWV",
    "finding": "Concise description of the evidence-based issue",
    "fix": "One concise, actionable fix",
    "estimated_impact": "High|Medium|Low",
    "effort": "Hours|Days|Weeks",
    "falsifiability_check": "One concise way to verify the fix"
  }],
  "executive_summary": "Plain English, three sentences maximum"
}

Return 0 for all score fields; the application calculates scores with a fixed evidence-based rubric. Do not mention or estimate numerical scores in the executive summary. Include at most 5 critical issues, 8 important issues, 5 quick wins, and 8 recommendations. Keep every array item and recommendation field concise. Critical, important, and quick-win items must be strings. Ensure each quick win can be completed in two hours or less. Recommendation category, priority, impact, and effort must use exactly one of the listed values.`;


const maxAttempts = 3;

const transientStatuses = new Set([429, 500, 502, 503, 504]);

function retryDelay(response: Response, retryIndex: number) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const retryAt = Date.parse(retryAfter);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : retryAt - Date.now();
    if (Number.isFinite(delay) && delay > 0) return Math.min(delay, 30_000);
  }
  return 1000 * 2 ** retryIndex;
}

function extractJsonObject(text: string) {
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const start = cleaned.indexOf("{");
    if (start === -1) throw new Error("Claude returned invalid JSON");

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < cleaned.length; index++) {
      const character = cleaned[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === "\"") inString = false;
      } else if (character === "\"") {
        inString = true;
      } else if (character === "{") {
        depth++;
      } else if (character === "}" && --depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, index + 1)) as unknown;
        } catch {
          throw new Error("Claude returned invalid JSON");
        }
      }
    }
    throw new Error("Claude returned incomplete JSON");
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function createMockAnalysis(data: unknown): AuditResult {
  const signals = asRecord(data);
  const onPage = asRecord(signals.on_page);
  const headings = asRecord(onPage.headings);
  const images = asRecord(onPage.images);
  const technical = asRecord(signals.technical);
  const schema = asRecord(signals.schema);
  const schemaValidation = asRecord(schema.validation);
  const recommendations: AuditResult["recommendations"] = [];

  const recommend = (
    category: AuditResult["recommendations"][number]["category"],
    finding: string,
    fix: string,
    falsifiability_check: string,
    effort: AuditResult["recommendations"][number]["effort"] = "Hours"
  ) => recommendations.push({
    priority: "HIGH",
    category,
    finding,
    fix,
    estimated_impact: "Medium",
    effort,
    falsifiability_check
  });

  if (typeof onPage.title !== "string" || !onPage.title.trim()) {
    recommend("OnPage", "The crawled page has no title element.", "Add a concise, page-specific title element.", "Confirm the rendered page title in the HTML and search preview.");
  }
  if (typeof onPage.metaDescription !== "string" || !onPage.metaDescription.trim()) {
    recommend("OnPage", "The crawled page has no meta description.", "Add a unique description that accurately summarizes the page.", "Confirm the description is present in the rendered page source.");
  }
  const h1 = Array.isArray(headings.h1) ? headings.h1.filter((value) => typeof value === "string" && value.trim()) : [];
  if (h1.length !== 1) {
    recommend("Content", `The crawl found ${h1.length} non-empty H1 headings.`, "Use one descriptive H1 heading that reflects the page's main topic.", "Re-crawl the page and verify it contains exactly one non-empty H1.");
  }
  if (typeof onPage.canonical !== "string" || !onPage.canonical.trim()) {
    recommend("Technical", "The crawled page has no canonical link.", "Add a canonical link pointing to the preferred URL for this page.", "Verify the canonical link resolves to the intended public URL.");
  }
  if (typeof images.total === "number" && images.total > 0 && typeof images.missingAlt === "number" && images.missingAlt > 0) {
    recommend("OnPage", `${images.missingAlt} of ${images.total} crawled images have no non-empty alt text.`, "Add concise, descriptive alt text to informative images and empty alt attributes to decorative images.", "Re-crawl the page and confirm the missing-alt count is reduced.");
  }
  if (technical.sitemapAvailable === false) {
    recommend("Technical", "A sitemap was not found at the checked sitemap locations.", "Publish an XML sitemap and reference it from robots.txt.", "Verify the sitemap URL returns a successful response and is listed in robots.txt.");
  }
  if (typeof schemaValidation.invalidJson === "number" && schemaValidation.invalidJson > 0) {
    recommend("Schema", `${schemaValidation.invalidJson} structured-data script(s) contain invalid JSON.`, "Correct the JSON syntax in each affected JSON-LD script.", "Validate the updated JSON-LD and re-crawl the page.");
  }
  if (Array.isArray(schema.types) && schema.types.length === 0) {
    recommend("Schema", "The crawl found no Schema.org structured-data types.", "Add relevant, accurate structured data for the page and business.", "Use a structured-data validator to confirm the expected Schema.org types are detected.");
  }

  const mockMetadata = asRecord(signals.mock_data);
  const vitals = asRecord(signals.core_web_vitals);
  const categories = asRecord(vitals.categories);
  const performance = categories.performance;
  if (
    mockMetadata.applies_to_audited_host === true &&
    typeof performance === "number" &&
    performance < 0.7
  ) {
    recommend("CWV", `The applicable PageSpeed fixture reports a performance score of ${performance}.`, "Review the recorded PageSpeed diagnostics and address the highest-impact items first.", "Run PageSpeed again for the same URL and compare its performance category.", "Days");
  }

  const quickWins = recommendations.filter((item) => item.effort === "Hours").slice(0, 5);
  return {
    audit_version: "v1.0",
    overall_score: 0,
    score_breakdown: {
      technical: 0,
      on_page: 0,
      content: 0,
      core_web_vitals: null,
      schema: 0
    },
    critical_issues: [],
    important_issues: recommendations.slice(0, 8).map((item) => item.finding),
    quick_wins: quickWins.map((item) => item.finding),
    recommendations: recommendations.slice(0, 8),
    executive_summary: recommendations.length
      ? `The website crawl found ${recommendations.length} evidence-based opportunities in the collected page and technical signals. ${mockMetadata.applies_to_audited_host === true ? "Applicable mock PageSpeed data was included." : "External sample metrics were excluded because they do not match the audited host."}`
      : "The collected crawl signals did not identify issues covered by this mock analysis. External sample metrics were excluded unless they matched the audited host."
  };
}

export async function analyzeAudit(data: unknown): Promise<AuditResult> {
  if (useMocks) return auditResultSchema.parse(createMockAnalysis(data));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required when USE_MOCKS=false");
  const requestBody = JSON.stringify({
    model: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6",
    max_tokens: 8192,
    temperature: 0,
    system: masterPrompt,
    messages: [{
      role: "user",
      content: `Analyze the following collected SEO signals. Use only these facts and follow the required JSON structure.\n${JSON.stringify(data)}`
    }]
  });
  let response: Response | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const currentResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: requestBody,
      signal: AbortSignal.timeout(60000)
    });
    response = currentResponse;
    if (currentResponse.ok || !transientStatuses.has(currentResponse.status) || attempt === maxAttempts - 1) break;
    await new Promise((resolve) => setTimeout(resolve, retryDelay(currentResponse, attempt)));
  }
  if (!response) throw new Error("Claude request did not produce a response");
  if (!response.ok) throw new Error(`Claude API failed with HTTP ${response.status}`);
  const payload = await response.json() as {
    content?: Array<{ type?: string; text?: string }>;
    stop_reason?: string | null;
  };
  const text = payload.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Claude returned no text content");
  let parsed: unknown;
  try {
    parsed = extractJsonObject(text);
  } catch (error) {
    if (payload.stop_reason) {
      throw new Error(`${error instanceof Error ? error.message : "Claude returned invalid JSON"} (stop reason: ${payload.stop_reason})`);
    }
    throw error;
  }
  const validated = auditResultSchema.safeParse(parsed);
  if (!validated.success) throw new Error(`Claude response did not match the audit schema: ${validated.error.message}`);
  return validated.data;
}
