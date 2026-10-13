type CurationMessageInput = {
  to: string;
  creatorName: string;
  curatorName: string;
  campaignName: string;
  subject: string;
  message: string;
};

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
})[character] ?? character);

export async function sendCurationMessage(input: CurationMessageInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "missing_configuration" as const };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "Pills <notificaciones@pills.social>",
      to: [input.to],
      reply_to: process.env.RESEND_REPLY_TO || undefined,
      subject: `[Curaduría Pills] ${input.subject}`,
      html: `<div style="background:#f6f4ef;padding:40px 18px;font-family:Arial,sans-serif;color:#181816"><div style="max-width:580px;margin:auto;background:#fff;border:1px solid #e7e4dd;border-radius:18px;padding:34px"><div style="font-size:12px;letter-spacing:2px;color:#6c45ff;font-weight:700">CURADURÍA PILLS</div><h1 style="font-size:28px;line-height:1.1;margin:18px 0">Consulta sobre “${escapeHtml(input.campaignName)}”.</h1><p style="font-size:15px;line-height:1.6;color:#615e57">Hola ${escapeHtml(input.creatorName)}, el equipo de Curaduría necesita aclarar un antecedente antes de continuar con la revisión.</p><div style="white-space:pre-wrap;background:#f6f4ef;border-radius:12px;padding:18px;font-size:15px;line-height:1.65;color:#302e29">${escapeHtml(input.message)}</div><p style="font-size:12px;line-height:1.5;color:#8a867e;margin-top:24px">Enviado por ${escapeHtml(input.curatorName)} desde Creator Studio. Responde a este correo si la opción está habilitada o actualiza la información de tu Pill.</p></div></div>`,
    }),
  });
  if (!response.ok) return { sent: false, reason: "provider_error" as const, detail: await response.text() };
  const result = await response.json() as { id?: string };
  return { sent: true, id: result.id ?? null };
}
