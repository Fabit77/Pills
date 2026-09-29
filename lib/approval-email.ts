type ApprovalEmailInput = { campaignId: string; to: string; campaignName: string; creatorName: string; collectUrl: string };

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);

export async function sendCollectibleApprovedEmail(input: ApprovalEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "missing_configuration" as const };
  const name = escapeHtml(input.creatorName || "creador");
  const campaign = escapeHtml(input.campaignName);
  const url = escapeHtml(input.collectUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `pill-approved-${input.campaignId}` },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "Pills <hola@ruca.digital>", to: [input.to], subject: `Tu Pill “${input.campaignName}” fue aprobada`,
      html: `<div style="background:#f6f4ef;padding:40px 18px;font-family:Arial,sans-serif;color:#181816"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e7e4dd;border-radius:18px;padding:34px"><div style="font-size:12px;letter-spacing:2px;color:#f15a29;font-weight:700">PILLS CREATOR STUDIO</div><h1 style="font-size:32px;line-height:1.05;margin:18px 0">Tu Pill fue aprobada.</h1><p style="font-size:15px;line-height:1.6;color:#615e57">Hola ${name}, <strong>${campaign}</strong> ya puede coleccionarse. El QR y el enlace que preparaste mientras estaba en revisión ya están activos.</p><a href="${url}" style="display:inline-block;margin-top:18px;background:#f15a29;color:#fff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:10px">Ver Pill para coleccionar</a><p style="font-size:12px;line-height:1.5;color:#8a867e;margin-top:26px">También puedes entrar a Creator Studio para descargar nuevamente el QR y revisar las colecciones.</p></div></div>`,
    }),
  });
  if (!response.ok) return { sent: false, reason: "provider_error" as const, detail: await response.text() };
  const result = await response.json() as { id?: string };
  return { sent: true, id: result.id ?? null };
}
