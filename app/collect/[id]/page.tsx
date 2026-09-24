import { redirect } from "next/navigation";

export default async function LegacySecretClaimRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`https://pills-fans-web.vercel.app/collect/${encodeURIComponent(id)}`);
}
