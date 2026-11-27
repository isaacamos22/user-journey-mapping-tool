import { DiscoveryWorkbench } from "@/components/discovery/DiscoveryWorkbench";
import { loadDiscoveryWorkbenchPage } from "@/lib/journey/loadDiscoveryWorkbenchPage";

export default async function JourneyMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const props = await loadDiscoveryWorkbenchPage(id);

  return <DiscoveryWorkbench {...props} />;
}