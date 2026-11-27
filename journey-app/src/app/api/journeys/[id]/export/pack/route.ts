import { requireSessionUser } from "@/lib/auth/sessionUser";
import { loadJourney } from "@/lib/journey/loadJourney";
import { getJourneyRole, canRead } from "@/lib/rbac";
import { buildExportPackZip } from "@/lib/export/buildExportPack";
import { prisma } from "@/lib/db";
import { ExportFormat } from "@prisma/client";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const user = await requireSessionUser();
  const role = await getJourneyRole(user.id, id);
  if (!canRead(role)) return new Response("Forbidden", { status: 403 });

  const journey = await loadJourney(id);
  if (!journey) return new Response("Not found", { status: 404 });

  const reqs = journey.requirements
    .map((r) => `# ${r.title}\n${r.bodyJson}`)
  const stories = journey.userStories.map((s) => `# ${s.title}\n${s.bodyJson}`);

  const zip = await buildExportPackZip(journey, {
    requirementsMd: reqs.join("\n\n"),
    storiesMd: stories.join("\n\n"),
  });

  await prisma.exportArtifact.create({
    data: {
      journeyId: journey.id,
      type: "export_pack",
      format: ExportFormat.ZIP,
    },
  });

  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${journey.slug}-pack.zip"`,
    },
  });
}