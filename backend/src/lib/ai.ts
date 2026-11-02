import { auditResultSchema, type AuditResult } from "@backend/lib/audit-schema";

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


const maxGeminiAttempts = 3;

const transientGeminiStatuses = new Set([429, 500, 502, 503, 504]);

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
    if (start === -1) throw new Error("Gemini returned invalid JSON");

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
          throw new Error("Gemini returned invalid JSON");
        }
      }
    }
    throw new Error("Gemini returned incomplete JSON");
  }
}

export async function analyzeAudit(data: unknown): Promise<AuditResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required to run an audit");
  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: masterPrompt }] },
    contents: [{ role: "user", parts: [{ text: `Analyze the following collected SEO signals. Use only these facts and follow the required JSON structure.\n${JSON.stringify(data)}` }] }],
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: 16384 }
  });
  let response: Response | undefined;
  for (let attempt = 0; attempt < maxGeminiAttempts; attempt++) {
    const currentResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: requestBody,
      signal: AbortSignal.timeout(60000)
    });
    response = currentResponse;
    if (currentResponse.ok || !transientGeminiStatuses.has(currentResponse.status) || attempt === maxGeminiAttempts - 1) break;
    await new Promise((resolve) => setTimeout(resolve, retryDelay(currentResponse, attempt)));
  }
  if (!response) throw new Error("Gemini request did not produce a response");
  if (!response.ok) throw new Error(`Gemini API failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("Gemini returned no text content");
  let parsed: unknown;
  try {
    parsed = extractJsonObject(text);
  } catch (error) {
    const finishReason = payload.candidates?.[0]?.finishReason;
    if (finishReason) {
      throw new Error(`${error instanceof Error ? error.message : "Gemini returned invalid JSON"} (finish reason: ${finishReason})`);
    }
    throw error;
  }
  const validated = auditResultSchema.safeParse(parsed);
  if (!validated.success) throw new Error(`Gemini response did not match the audit schema: ${validated.error.message}`);
  return validated.data;
}
