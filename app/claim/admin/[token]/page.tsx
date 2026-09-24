import { redirect } from "next/navigation";

export default async function LegacyAdminClaimRedirect({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`https://pills-fans-web.vercel.app/claim/admin/${encodeURIComponent(token)}`);
}
