import { prisma } from "../src/lib/db";

const journeyId = process.argv[2] ?? "cmwugjdh10002mu54ibgwbeqm";

async function main() {
  const root = await prisma.step.findFirst({
    where: { journeyId, title: "Configure rig template", parentStepId: null },
  });
  if (!root) {
    console.log("root not found");
    return;
  }
  const kids = await prisma.step.findMany({
    where: { parentStepId: root.id },
    orderBy: { order: "asc" },
    select: { id: true, order: true, userAction: true, actionFlowBranchId: true },
  });
  const links = await prisma.stepFlowLink.findMany({ where: { journeyId } });
  const kidIds = new Set(kids.map((k) => k.id));
  const relevant = links.filter(
    (l) => kidIds.has(l.fromStepId) || kidIds.has(l.toStepId)
  );
  const byId = new Map(kids.map((k) => [k.id, k.userAction?.slice(0, 48) ?? ""]));
  console.log(
    JSON.stringify(
      {
        actions: kids.map((k) => ({
          order: k.order,
          branch: k.actionFlowBranchId,
          text: k.userAction?.slice(0, 60),
        })),
        mergeLinks: relevant.map((l) => ({
          from: byId.get(l.fromStepId),
          to: byId.get(l.toStepId),
        })),
      },
      null,
      2
    )
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });