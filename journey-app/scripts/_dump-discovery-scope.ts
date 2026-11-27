import { prisma } from "../src/lib/db";
import { loadJourney } from "../src/lib/journey/loadJourney";

async function main() {
  const id = "cmwu0uc230002mu3c2zsgjvst";
  const j = await loadJourney(id);
  if (!j) {
    console.log("NOT FOUND");
    return;
  }
  const roots = j.phases.flatMap((ph) =>
    ph.steps.filter((s) => !s.parentStepId).map((s) => ({ ...s, phaseTitle: ph.title }))
  );
  const setup = roots.find((s) => s.id === "cmwu0uc4o000imu3c0xl0fx97");
  const pain = setup?.painPoints.find((p) => p.id === "cmwu0uc6m000smu3c0lxceugv");
  const opps = j.opportunities.filter((o) => o.stepIds?.includes(setup?.id ?? ""));
  console.log(
    JSON.stringify(
      {
        title: j.title,
        personas: j.personas.map((p) => ({ id: p.id, name: p.name, role: p.role })),
        setup: setup
          ? {
              id: setup.id,
              title: setup.title,
              phaseTitle: setup.phaseTitle,
              experienceGoal: setup.experienceGoal,
              pain,
              allPains: setup.painPoints.map((p) => ({
                id: p.id,
                description: p.description,
                severity: p.severity,
              })),
              opportunities: opps.map((o) => o.title),
              actions: setup.children.map((c) => ({
                id: c.id,
                userAction: c.userAction,
                touchpoint: c.touchpoints[0],
              })),
            }
          : null,
      },
      null,
      2
    )
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());