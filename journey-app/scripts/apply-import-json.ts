/**
 * Apply a journey import JSON file locally (used from Cursor chat / CLI).
 * Usage: npx tsx scripts/apply-import-json.ts path/to/draft.json
 */
import fs from "node:fs";
import path from "node:path";
import { parseJsonImport } from "../src/lib/import/extractors/csvJson";
import { enrichImportDraft } from "../src/lib/import/enrichImportDraft";
import { applyImportDraft } from "../src/lib/import/mapDraftToJourney";
import { scoreImportDraftQuality } from "../src/lib/import/importQuality";
import { getLocalUser } from "../src/lib/auth/localUser";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx scripts/apply-import-json.ts <draft.json>");
    process.exit(1);
  }
  const abs = path.resolve(file);
  const text = fs.readFileSync(abs, "utf8");
  let draft = parseJsonImport(text);
  const { draft: enriched } = await enrichImportDraft(draft);
  draft = enriched;

  const user = await getLocalUser();
  const importQuality = scoreImportDraftQuality(draft);
  const journeyId = await applyImportDraft(draft, user.id, undefined, "create");

  console.log(
    JSON.stringify({
      ok: true,
      journeyId,
      title: draft.title,
      map: `/journeys/${journeyId}/map`,
      importQuality,
    })
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});