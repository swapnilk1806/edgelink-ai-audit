import type { AuditResult } from "@backend/lib/audit-schema";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function boundedScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreSeoSignals(data: unknown): Pick<AuditResult, "overall_score" | "score_breakdown"> {
  const signals = record(data);
  const crawl = record(signals.crawl);
  const onPage = Object.keys(record(signals.on_page)).length > 0 ? record(signals.on_page) : crawl;
  const technical = Object.keys(record(signals.technical)).length > 0
    ? record(signals.technical)
    : record(signals.crawlability);
  const schema = Object.keys(record(signals.schema)).length > 0
    ? record(signals.schema)
    : { types: crawl.schemaTypes, validation: signals.schema_validation ?? crawl.schemaValidation };
  const validation = record(schema.validation);
  const images = record(onPage.images);
  const links = record(onPage.links);
  const headings = record(onPage.headings);
  const h1 = Array.isArray(headings.h1) ? headings.h1.filter((value) => text(value)) : [];
  const h2 = Array.isArray(headings.h2) ? headings.h2.filter((value) => text(value)) : [];
  const title = text(onPage.title);
  const description = text(onPage.metaDescription);
  const robotsTxt = text(technical.robotsTxt);
  const schemaTypes = Array.isArray(schema.types) ? schema.types : [];
  const coreWebVitals = record(signals.core_web_vitals);
  const mockMetadata = record(signals.mock_data);
  const canUseVitals = mockMetadata.enabled === false ||
    (mockMetadata.enabled === true && mockMetadata.applies_to_audited_host === true);
  const performanceScore = canUseVitals ? record(coreWebVitals.categories).performance : null;
  const measuredVitals = typeof performanceScore === "number" && Number.isFinite(performanceScore)
    ? boundedScore(performanceScore * 100)
    : null;

  let technicalScore = 100;
  if (/^\s*disallow\s*:\s*\/\s*(?:#.*)?$/im.test(robotsTxt)) technicalScore -= 50;
  if (technical.sitemapAvailable === false) technicalScore -= 10;

  let onPageScore = 100;
  if (!title) onPageScore -= 20;
  if (!description) onPageScore -= 15;
  if (h1.length === 0) onPageScore -= 15;
  if (h1.length > 1) onPageScore -= 5;
  if (!text(onPage.canonical)) onPageScore -= 10;
  if (typeof images.total === "number" && images.total > 0 && typeof images.missingAlt === "number") {
    onPageScore -= Math.round(Math.min(15, (images.missingAlt / images.total) * 15));
  }
  if (links.internal === 0) onPageScore -= 5;

  let contentScore = 0;
  if (title) contentScore += 20;
  if (title.length >= 30 && title.length <= 60) contentScore += 5;
  if (description) contentScore += 20;
  if (description.length >= 120 && description.length <= 160) contentScore += 5;
  if (h1.length > 0) contentScore += 20;
  if (h2.length > 0) contentScore += 15;
  if (h1.length + h2.length >= 3) contentScore += 15;

  let schemaScore = 100;
  const invalidJson = typeof validation.invalidJson === "number" ? validation.invalidJson : 0;
  const missingContextOrType = typeof validation.missingSchemaContextOrType === "number"
    ? validation.missingSchemaContextOrType
    : 0;
  if (schemaTypes.length === 0) schemaScore -= 20;
  schemaScore -= Math.min(50, invalidJson * 25);
  schemaScore -= Math.min(30, missingContextOrType * 10);

  const score_breakdown = {
    technical: boundedScore(technicalScore),
    on_page: boundedScore(onPageScore),
    content: boundedScore(contentScore),
    core_web_vitals: measuredVitals,
    schema: boundedScore(schemaScore)
  };
  const measuredScores = Object.values(score_breakdown).filter((score): score is number => score !== null);

  return {
    overall_score: boundedScore(measuredScores.reduce((total, score) => total + score, 0) / measuredScores.length),
    score_breakdown
  };
}

export function applySeoScore(result: unknown, sourceData: unknown) {
  if (result === null || typeof result !== "object" || Array.isArray(result)) return result;
  return { ...record(result), ...scoreSeoSignals(sourceData) };
}
