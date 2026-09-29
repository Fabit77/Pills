import { redirect } from "next/navigation";

export default async function LegacyQrClaimRedirect({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const fansUrl = process.env.NEXT_PUBLIC_PILLSFANS_URL || "https://fans.pills.social";
  redirect(`${fansUrl}/claim/${encodeURIComponent(token)}`);
}
