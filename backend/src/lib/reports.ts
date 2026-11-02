import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import type { AuditResult } from "@backend/lib/audit-schema";
import { logR2Upload } from "@backend/mocks/index.js";

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}

function renderReport(audit: AuditResult, url: string) {
  const recommendations = audit.recommendations.map((item) => `<tr><td>${escapeHtml(item.priority)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.finding)}</td><td>${escapeHtml(item.fix)}</td><td>${escapeHtml(item.estimated_impact)}</td><td>${escapeHtml(item.effort)}</td><td>${escapeHtml(item.falsifiability_check)}</td></tr>`).join("");
  const renderIssues = (issues: unknown[]) => issues.map((issue) => `<li>${escapeHtml(typeof issue === "string" ? issue : JSON.stringify(issue))}</li>`).join("");
  const scoreBreakdown = Object.entries(audit.score_breakdown)
    .map(([category, score]) => `<li>${escapeHtml(category.replaceAll("_", " "))}: ${score === null ? "Not measured" : `${escapeHtml(score)}/100`}</li>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{font:14px Arial,sans-serif;color:#172333;margin:36px}h1{color:#1d7a68}h2{margin-top:30px;border-bottom:1px solid #dfe7e9;padding-bottom:8px}
  .score{font-size:38px;font-weight:bold;color:#1d7a68}.muted{color:#6d7b8b}table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{border:1px solid #dfe7e9;padding:8px;text-align:left;vertical-align:top}th{background:#f4f7f8}
  </style></head><body><h1>Edgelink SEO Audit</h1><p class="muted">${escapeHtml(url)}</p><p class="score">${escapeHtml(audit.overall_score)} / 100</p>
  <h2>Category scores</h2><ul>${scoreBreakdown}</ul><p class="muted">Scores use a consistent evidence-based rubric. Unavailable measurements are excluded from the overall score.</p>
  <h2>Executive summary</h2><p>${escapeHtml(audit.executive_summary)}</p><h2>Recommendations</h2><table><thead><tr><th>Priority</th><th>Category</th><th>Finding</th><th>Fix</th><th>Impact</th><th>Effort</th><th>Verification</th></tr></thead><tbody>${recommendations}</tbody></table>
  <h2>Critical issues</h2><ul>${renderIssues(audit.critical_issues)}</ul>
  <h2>Important issues</h2><ul>${renderIssues(audit.important_issues)}</ul>
  <h2>Quick wins</h2><ul>${renderIssues(audit.quick_wins)}</ul></body></html>`;
}

export async function generatePdf(auditId: string, result: AuditResult, url: string) {
  const reportDirectory = process.env.REPORT_STORAGE_DIR || "./reports";
  const directory = path.isAbsolute(reportDirectory)
    ? reportDirectory
    : path.resolve(backendDirectory, reportDirectory);
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `${auditId}.pdf`);
  const chromeCandidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.PROGRAMFILES ? path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe") : undefined,
    process.env["PROGRAMFILES(X86)"] ? path.join(process.env["PROGRAMFILES(X86)"]!, "Google", "Chrome", "Application", "chrome.exe") : undefined,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe") : undefined
  ].filter((candidate): candidate is string => Boolean(candidate));
  const localChrome = chromeCandidates.find(existsSync);
  const isWindows = platform() === "win32";
  if (isWindows && !localChrome) {
    throw new Error("Chrome was not found. Install Google Chrome or set PUPPETEER_EXECUTABLE_PATH.");
  }
  const executablePath = localChrome || await chromium.executablePath();
  const browser = await puppeteer.launch({
    args: localChrome ? ["--no-sandbox"] : chromium.args,
    executablePath,
    headless: true
  });
  try {
    const page = await browser.newPage();
    await page.setContent(renderReport(result, url), { waitUntil: "networkidle0" });
    await page.pdf({ path: filePath, format: "A4", printBackground: true, margin: { top: "18mm", bottom: "18mm", left: "14mm", right: "14mm" } });
  } finally { await browser.close(); }
  await logR2Upload({ filePath, key: `${auditId}.pdf` });
  return filePath;
}
