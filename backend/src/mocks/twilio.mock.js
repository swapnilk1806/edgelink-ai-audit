export function sendWhatsApp({ clientId, pdfPath, score }) {
  console.info("[MOCK WHATSAPP] → Client:", clientId);
  console.info("[MOCK WHATSAPP] → Score:", `${score}/100`);
  console.info("[MOCK WHATSAPP] → Report:", pdfPath);
  return { status: "mock_sent", sid: `MOCK_SID_${Date.now()}` };
}

export function sendEmail({ to, auditId }) {
  console.info(JSON.stringify({ event: "mock.email.sent", to, auditId, at: new Date().toISOString() }));
  return { provider: "mock", status: "logged" };
}
