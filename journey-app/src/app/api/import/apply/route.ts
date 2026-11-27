import { requireSessionUser } from "@/lib/auth/sessionUser";
import { assertNotGuest } from "@/lib/auth/guestAuth";
import { prisma } from "@/lib/db";
import { applyImportDraft } from "@/lib/import/mapDraftToJourney";
import { applyJourneyExportPack } from "@/lib/import/applyJourneyExportPack";
import type { ImportDraft } from "@/lib/import/types";

export async function POST(req: Request) {
  const user = await requireSessionUser();
  assertNotGuest(user);
  const { jobId, journeyId, mode } = await req.json();
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job?.draftJson) return Response.json({ error: "Job not found" }, { status: 404 });
  const draft = JSON.parse(job.draftJson) as ImportDraft;
  const id = draft.exportPackV1
    ? await applyJourneyExportPack(draft.exportPackV1, user.id)
    : await applyImportDraft(
        draft,
        user.id,
        journeyId,
        mode === "append" ? "append" : "create"
      );
  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: "APPLIED", journeyId: id },
  });
  return Response.json({ journeyId: id });
}