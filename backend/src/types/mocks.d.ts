declare module "@backend/mocks/index.js" {
  export const pagespeed: Record<string, unknown>;
  export const gsc: Record<string, unknown>;
  export const dataforseo: Record<string, unknown>;
  export function logR2Upload(input: { filePath: string; key: string }): Promise<{ provider: string; status: string }>;
  export function sendEmail(input: { to: string | null; auditId: string }): { provider: string; status: string };
  export function sendWhatsApp(input: { clientId: string; pdfPath: string; score: number }): { status: string; sid: string };
}
