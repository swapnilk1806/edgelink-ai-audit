import { z } from "zod";

const issue = z.union([z.string(), z.object({}).passthrough()]);
export const auditResultSchema = z.object({
  audit_version: z.literal("v1.0"),
  overall_score: z.number().int().min(0).max(100),
  score_breakdown: z.object({
    technical: z.number().int().min(0).max(100),
    on_page: z.number().int().min(0).max(100),
    content: z.number().int().min(0).max(100),
    core_web_vitals: z.number().int().min(0).max(100).nullable(),
    schema: z.number().int().min(0).max(100)
  }).strict(),
  critical_issues: z.array(issue).max(5),
  important_issues: z.array(issue).max(8),
  quick_wins: z.array(issue).max(5),
  recommendations: z.array(z.object({
    priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
    category: z.enum(["Technical", "OnPage", "Content", "Schema", "CWV"]),
    finding: z.string(),
    fix: z.string(),
    estimated_impact: z.enum(["High", "Medium", "Low"]),
    effort: z.enum(["Hours", "Days", "Weeks"]),
    falsifiability_check: z.string()
  }).strict()),
  executive_summary: z.string()
}).strict();

export type AuditResult = z.infer<typeof auditResultSchema>;
