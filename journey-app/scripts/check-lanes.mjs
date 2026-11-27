import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
try {
  const cols = await p.$queryRaw`PRAGMA table_info('Step')`;
  console.log("Step columns:", cols.map((c) => c.name));
  const rows = await p.$queryRaw`
    SELECT id, substr(COALESCE("userAction","title"),1,40) AS label,
           "actionFlowBranchId", "parentStepId", "order"
    FROM "Step"
    WHERE "parentStepId" IS NOT NULL
    ORDER BY "parentStepId", "order"
    LIMIT 30
  `;
  console.log("Child steps:", JSON.stringify(rows, null, 2));
  const links = await p.$queryRaw`
    SELECT "fromStepId", "toStepId" FROM "StepFlowLink" LIMIT 30
  `;
  console.log("Flow links:", JSON.stringify(links, null, 2));
} catch (e) {
  console.error(e);
} finally {
  await p.$disconnect();
}