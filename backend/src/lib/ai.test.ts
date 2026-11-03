import assert from "node:assert/strict";
import { before, test } from "node:test";

let analyzeAudit: typeof import("./ai").analyzeAudit;

before(async () => {
  process.env.USE_MOCKS = "true";
  delete process.env.ANTHROPIC_API_KEY;
  ({ analyzeAudit } = await import("./ai"));
});

function signals(appliesToAuditedHost: boolean) {
  return {
    on_page: {
      title: "",
      metaDescription: "",
      headings: { h1: [] },
      images: { total: 2, missingAlt: 1 },
      links: { internal: 0 }
    },
    technical: { sitemapAvailable: false },
    schema: { types: [], validation: { invalidJson: 0 } },
    core_web_vitals: { categories: { performance: 0.61 } },
    gsc: { total_clicks: 420 },
    keyword_rankings: { client_rank_position: 4 },
    mock_data: { enabled: true, applies_to_audited_host: appliesToAuditedHost }
  };
}

test("mock analysis validates structured findings without credentials and excludes unrelated fixture data", async () => {
  const result = await analyzeAudit(signals(false));

  assert.equal(result.audit_version, "v1.0");
  assert.equal(result.overall_score, 0);
  assert.equal(result.score_breakdown.core_web_vitals, null);
  assert.ok(result.recommendations.length > 0);
  assert.ok(!result.recommendations.some((item) => item.finding.includes("PageSpeed")));
  assert.ok(result.recommendations.every((item) =>
    item.priority && item.category && item.finding && item.fix &&
    item.estimated_impact && item.effort && item.falsifiability_check
  ));
});

test("mock analysis uses PageSpeed evidence only for a matching audited host", async () => {
  const result = await analyzeAudit(signals(true));

  assert.ok(result.recommendations.some((item) => item.category === "CWV"));
});
