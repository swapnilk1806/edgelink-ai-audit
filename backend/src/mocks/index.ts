export const pagespeed = {
  url: "https://example.com",
  categories: { performance: 0.9, accessibility: 0.88, best_practices: 0.91, seo: 0.89 },
  diagnostics: ["AMD page speed fixture data"],
  summary: "Mock PageSpeed data for local development"
};

export const gsc = {
  url: "https://example.com",
  total_clicks: 420,
  total_impressions: 12000,
  average_ctr: 3.5,
  average_position: 14.7,
  queries: [{ query: "seo audit", clicks: 85, impressions: 1400 }]
};

export const dataforseo = {
  url: "https://example.com",
  keyword_rankings: [{ keyword: "seo services", position: 12, volume: 3200 }],
  summary: "Mock DataForSEO rankings"
};

export async function logR2Upload(input: { filePath: string; key: string }) {
  return { provider: "mock-r2", status: "uploaded", filePath: input.filePath, key: input.key };
}

export function sendEmail(input: { to: string | null; auditId: string }) {
  return { provider: "mock-email", status: "queued", to: input.to, auditId: input.auditId };
}

export function sendWhatsApp(input: { clientId: string; pdfPath: string; score: number }) {
  return { status: "queued", sid: `whatsapp-${input.clientId}`, pdfPath: input.pdfPath, score: input.score };
}
