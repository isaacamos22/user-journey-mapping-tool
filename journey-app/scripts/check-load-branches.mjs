import { PrismaClient } from "@prisma/client";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const p = new PrismaClient();
const journeyId = "cmwnd33o10001mu3c8f164uhr";
const journey = await p.journey.findUnique({
  where: { id: journeyId },
  include: {
    phases: {
      take: 1,
      include: {
        steps: {
          include: { children: true },
        },
      },
    },
  },
});
const phase = journey.phases[0];
const allStepIds = [];
for (const root of phase.steps) {
  allStepIds.push(root.id);
  for (const child of root.children) allStepIds.push(child.id);
}
console.log("ids", allStepIds.length);

const { loadActionFlowBranchIds, normalizeActionFlowBranchId } = await import(
  "../src/lib/journey/actionFlowBranch.ts"
);
const map = await loadActionFlowBranchIds(allStepIds);
console.log("map size", map.size);
for (const [id, lane] of map) {
  console.log(id.slice(-6), lane);
}

const child = phase.steps[0].children[0];
console.log("sample attach", normalizeActionFlowBranchId(child.id, map.get(child.id)));

await p.$disconnect();