/**
 * Delete journeys matching title substring and re-apply import JSON.
 * Usage: npx tsx scripts/reimport-by-title.ts <title-contains> <draft.json>
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { parseJsonImport } from "../src/lib/import/extractors/csvJson";
import { enrichImportDraft } from "../src/lib/import/enrichImportDraft";
import { applyImportDraft } from "../src/lib/import/mapDraftToJourney";
import { scoreImportDraftQuality } from "../src/lib/import/importQuality";
import { getLocalUser } from "../src/lib/auth/localUser";
import { sanitizeImportDraftWorkshopRows } from "../src/lib/import/workshopRowSemantics";

async function main() {
  const titleNeedle = process.argv[2];
  const file = process.argv[3];
  if (!titleNeedle || !file) {
    console.error("Usage: npx tsx scripts/reimport-by-title.ts <title-contains> <draft.json>");
    process.exit(1);
  }
  const abs = path.resolve(file);
  const text = fs.readFileSync(abs, "utf8");
  let draft = parseJsonImport(text);
  draft = sanitizeImportDraftWorkshopRows(
    (await enrichImportDraft(draft)).draft
  );

  const all = await prisma.journey.findMany({ select: { id: true, title: true } });
  const needle = titleNeedle.toLowerCase();
  const matches = all.filter((j) => j.title.toLowerCase().includes(needle));
  for (const j of matches) {
    await prisma.journey.delete({ where: { id: j.id } });
    console.error(`Deleted journey ${j.id} — ${j.title}`);
  }

  const user = await getLocalUser();
  const journeyId = await applyImportDraft(draft, user.id, undefined, "create");
  console.log(
    JSON.stringify({
      ok: true,
      journeyId,
      title: draft.title,
      map: `/journeys/${journeyId}/map`,
      importQuality: scoreImportDraftQuality(draft),
      deletedPrior: matches.map((m) => m.id),
    })
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});