import { PrismaClient } from "@prisma/client";
import { selfServiceDdrImportDraft, SELF_SERVICE_DDR_SLUG } from "../src/lib/import/packs/selfServiceDdr";
import { applyImportDraft } from "../src/lib/import/mapDraftToJourney";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.LOCAL_DEFAULT_USER_EMAIL || "facilitator@example.com";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Facilitator" },
  });

  const existing = await prisma.journey.findUnique({ where: { slug: SELF_SERVICE_DDR_SLUG } });
  if (existing) {
    await prisma.journey.delete({ where: { id: existing.id } });
    console.log("Removed existing journey:", SELF_SERVICE_DDR_SLUG);
  }

  const draft = selfServiceDdrImportDraft();
  const journeyId = await applyImportDraft(draft, user.id, undefined, "create");

  await prisma.journey.update({
    where: { id: journeyId },
    data: {
      slug: SELF_SERVICE_DDR_SLUG,
      businessContext:
        "Self-service DDR (Req 2807056): per-client rig templates, UX S1–S5 administrator path, S6 downstream.",
      goal: draft.sourceNotes,
    },
  });

  console.log("Imported Self-service DDR journey");
  console.log("  id:", journeyId);
  console.log("  slug:", SELF_SERVICE_DDR_SLUG);
  console.log("  map:", `/journeys/${journeyId}/map`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });