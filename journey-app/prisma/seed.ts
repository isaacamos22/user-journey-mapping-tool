import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "facilitator@example.com";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Facilitator" },
  });

  const journey = await prisma.journey.upsert({
    where: { slug: "onboarding-demo" },
    update: {},
    create: {
      title: "Onboarding demo",
      slug: "onboarding-demo",
      goal: "Help new users complete first workflow",
      businessContext: "Reduce time-to-value for enterprise adopters",
      status: "DRAFT",
      members: { create: { userId: user.id, role: "OWNER" } },
      personas: {
        create: {
          name: "Operations analyst",
          role: "Daily platform user",
          goals: "Finish setup without support tickets",
          frustrations: "Unclear next steps",
        },
      },
      phases: {
        create: {
          title: "Get started",
          order: 0,
          steps: {
            create: [
              {
                title: "Discover product",
                userAction: "Browse capability overview",
                order: 0,
                touchpoints: { create: { module: "Home", screen: "Landing" } },
                feelings: {
                  create: {
                    title: "Landing first impression",
                    confidence: 5,
                    frustration: 3,
                    delight: 5,
                  },
                },
              },
              {
                title: "Request access",
                userAction: "Submit access request form",
                order: 1,
                painPoints: {
                  create: {
                    description: "Form asks for IDs user does not know",
                    severity: 4,
                    evidence: "Workshop",
                  },
                },
                touchpoints: { create: { module: "Admin", screen: "Access request" } },
              },
            ],
          },
        },
      },
    },
  });

  console.log("Seed journey:", journey.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });