import { redirect } from "next/navigation";

export default function FanCollectionRedirect() {
  const fansUrl = process.env.NEXT_PUBLIC_PILLSFANS_URL || "https://fans.pills.social";
  redirect(`${fansUrl}/collection`);
}
