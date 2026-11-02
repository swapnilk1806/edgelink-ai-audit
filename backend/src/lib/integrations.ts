import { dataforseo, gsc, pagespeed } from "@backend/mocks/index.js";
import { useMocks } from "@backend/lib/env";

function hostname(value: string) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export async function collectExternalData(url: string) {
  if (useMocks) {
    const fixtureHost = hostname(String(pagespeed.url));
    const auditHost = hostname(url);
    const fixtureMatchesAudit = fixtureHost !== null && fixtureHost === auditHost;

    return {
      pagespeed: fixtureMatchesAudit ? pagespeed : null,
      gsc: fixtureMatchesAudit ? gsc : null,
      dataforseo: fixtureMatchesAudit ? dataforseo : null,
      mock_data: {
        enabled: true,
        fixture_host: fixtureHost,
        applies_to_audited_host: fixtureMatchesAudit
      }
    };
  }
  throw new Error("Live Google Search Console and DataForSEO providers are not configured. Set USE_MOCKS=true to run with the mock integrations.");
}
