import fs from "node:fs";
import { loadJourneySynthesis } from "../src/lib/journey/loadJourney";

async function main() {
const id = process.argv[2];
if (!id) {
  console.error("usage: id");
  process.exit(1);
}

const j = await loadJourneySynthesis(id);
if (!j) {
  console.error("NOT FOUND");
  process.exit(1);
}

function flattenSteps(
  steps: Array<{ children?: typeof steps } & Record<string, unknown>>,
  phaseTitle: string,
  out: Array<Record<string, unknown>> = []
) {
  for (const s of steps) {
    out.push({ ...s, phaseTitle });
    const kids = (s as { children?: typeof steps }).children;
    if (kids?.length) flattenSteps(kids, phaseTitle, out);
  }
  return out;
}

const allSteps = j.phases.flatMap((ph) => flattenSteps(ph.steps as never, ph.title));
const roots = allSteps.filter((s) => !s.parentStepId);
const journeyOpps = j.opportunities ?? [];

const dump = {
  id: j.id,
  title: j.title,
  personas: j.personas.map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    goals: p.goals,
    frustrations: p.frustrations,
  })),
  phases: j.phases.map((ph) => ({ id: ph.id, title: ph.title })),
  rootSteps: roots.map((s) => ({
    id: s.id,
    phaseTitle: s.phaseTitle,
    title: s.title,
    pains: (s.painPoints as { id: string; description: string; severity: number; opportunity?: string }[]).map(
      (pp) => ({
        id: pp.id,
        description: pp.description,
        severity: pp.severity,
        opportunity: pp.opportunity,
      })
    ),
    opportunityBullets: journeyOpps
      .filter((o) => (o.stepIds ?? "").includes(s.id as string))
      .map((o) => ({ id: o.id, title: o.title, if: o.ifClause, then: o.thenClause })),
    actions: allSteps
      .filter((c) => c.parentStepId === s.id)
      .map((c) => ({
        id: c.id,
        actionLane: c.actionFlowBranchId,
        userAction: c.userAction,
        title: c.title,
        touchpoints: (c.touchpoints as { module?: string; screen?: string }[] | undefined)?.map((t) => ({
          module: t.module,
          screen: t.screen,
        })),
      })),
  })),
};

const out = process.argv[3] ?? "-";
const json = JSON.stringify(dump, null, 2);
if (out === "-") console.log(json);
else fs.writeFileSync(out, json);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});