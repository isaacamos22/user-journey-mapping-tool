import { redirect } from "next/navigation";

/** Legacy URL — map and discovery live on `/map`. */
export default async function DiscoveryRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/journeys/${id}/map`);
}