import { CreatorCurationProfile } from "@/components/creator-curation-profile";

export default async function CreatorCurationPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ campaignId?: string; campaignName?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <CreatorCurationProfile creatorId={id} campaignId={query.campaignId} campaignName={query.campaignName} />;
}
