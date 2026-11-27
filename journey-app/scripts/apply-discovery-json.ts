/**
 * Apply a discovery JSON file to an existing journey (Cursor chat / CLI).
 * Usage: npx tsx scripts/apply-discovery-json.ts <journeyId> <draft.json>
 */
import fs from "node:fs";
import path from "node:path";
import {
  applyDiscoveryDraft,
  parseDiscoveryDraft,
} from "../src/lib/discovery/applyDiscoveryDraft";
import { getLocalUser } from "../src/lib/auth/localUser";

async function main() {
  const journeyId = process.argv[2];
  const file = process.argv[3];
  if (!journeyId || !file) {
    console.error("Usage: npx tsx scripts/apply-discovery-json.ts <journeyId> <draft.json>");
    process.exit(1);
  }
  const abs = path.resolve(file);
  const text = fs.readFileSync(abs, "utf8");
  const draft = parseDiscoveryDraft(text);
  const user = await getLocalUser();
  const append = process.argv.includes("--append");
  const replaceAll = process.argv.includes("--replace");
  const result = await applyDiscoveryDraft(journeyId, draft, user.id, {
    append,
    replaceAll,
  });
  console.log(
    JSON.stringify({
      ok: true,
      journeyId,
      ...result,
      analysisSummary: draft.analysisSummary ?? null,
      mode: replaceAll ? "replace-all" : append ? "append" : "coalesce-recent",
    })
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});