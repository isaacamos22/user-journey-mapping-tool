import { prisma } from "../src/lib/db";

const journeyId = process.argv[2] ?? "cmwuh2zgw0002muus9xk50m5r";

async function main() {
  const links = await prisma.stepFlowLink.findMany({
    where: { journeyId },
    select: { fromStepId: true, toStepId: true, kind: true },
  });
  const steps = await prisma.step.findMany({
    where: { phase: { journeyId } },
    select: { id: true, parentStepId: true, userAction: true },
  });
  const byId = new Map(steps.map((s) => [s.id, s]));
  let cross = 0;
  for (const l of links) {
    const from = byId.get(l.fromStepId);
    const to = byId.get(l.toStepId);
    if (!from?.parentStepId || !to?.parentStepId) continue;
    if (from.parentStepId === to.parentStepId) continue;
    cross += 1;
    console.log(
      `${l.kind}: ${from.userAction?.slice(0, 42)} → ${to.userAction?.slice(0, 42)}`
    );
  }
  console.log(`cross-phase links: ${cross} / ${links.length} total`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });