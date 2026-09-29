import { redirect } from "next/navigation";

export default async function LegacySecretClaimRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fansUrl = process.env.NEXT_PUBLIC_PILLSFANS_URL || "https://fans.pills.social";
  redirect(`${fansUrl}/collect/${encodeURIComponent(id)}`);
}
