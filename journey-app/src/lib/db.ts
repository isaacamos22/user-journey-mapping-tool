import { PrismaClient } from "@prisma/client";

/** Bumped when the generated client schema changes — invalidates stale dev singletons. */
const PRISMA_SINGLETON_KEY = "__journey_app_prisma_v_step_feeling__";

type GlobalWithPrisma = typeof globalThis & {
  [PRISMA_SINGLETON_KEY]?: PrismaClient;
  prisma?: PrismaClient;
};

function clientHasStepFeeling(client: PrismaClient | undefined): client is PrismaClient {
  return Boolean(client && typeof client.stepFeeling !== "undefined");
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getPrismaClient(): PrismaClient {
  const g = globalThis as GlobalWithPrisma;

  if (process.env.NODE_ENV !== "production") {
    if (clientHasStepFeeling(g[PRISMA_SINGLETON_KEY])) {
      return g[PRISMA_SINGLETON_KEY];
    }
    const client = createPrismaClient();
    if (!clientHasStepFeeling(client)) {
      throw new Error(
        "Prisma client is missing StepFeeling. Run: npx prisma generate — then restart the dev server."
      );
    }
    g[PRISMA_SINGLETON_KEY] = client;
    delete g.prisma;
    return client;
  }

  return g[PRISMA_SINGLETON_KEY] ?? createPrismaClient();
}

export const prisma = getPrismaClient();