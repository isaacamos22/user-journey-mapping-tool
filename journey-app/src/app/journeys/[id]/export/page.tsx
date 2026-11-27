import { redirect } from "next/navigation";

export default async function ExportRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/journeys/${id}/map`);
}