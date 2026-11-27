import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const rows = await prisma.$queryRaw`
  SELECT "id", "userAction", "actionFlowBranchId", "parentStepId", "order"
  FROM "Step"
  WHERE "parentStepId" IS NOT NULL
  ORDER BY "parentStepId", "order"
`;
console.log("children", JSON.stringify(rows, null, 2));
const links = await prisma.$queryRaw`SELECT * FROM "StepFlowLink"`;
console.log("links", JSON.stringify(links, null, 2));
await prisma.$disconnect();