/**
 * Emits FigJam placement JSON matching JourneyCanvas layoutColumnPositions.
 * Usage: npx tsx scripts/build-figjam-map-layout.ts <journeyId>
 */
import { groupActionsIntoSiblingRuns } from "../src/lib/journey/actionFlowLayout";
import { loadJourneyShell } from "../src/lib/journey/loadJourney";
import { loadStepFlowLinks } from "../src/lib/journey/loadStepFlowLinks";
import { loadPainOpportunitiesByStep } from "../src/lib/journey/loadPainOpportunities";
import { prisma } from "../src/lib/db";
import type { FlowLink } from "../src/lib/journey/flowLinks";

const NODE_W = 252;
const PHASE_GAP_PX = 96;
const MAP_STACK_GAP_PX = 28;
const ACTION_H_GAP = 28;
const ROOT_H = 320;
const ACTION_H = 96;

type StepLike = {
  id: string;
  title: string;
  userAction: string | null;
  parentStepId: string | null;
  actionFlowBranchId: string | null;
  order: number;
  phaseTitle: string;
};

function runWidthPx(runLen: number): number {
  if (runLen <= 1) return NODE_W;
  return NODE_W + (runLen - 1) * (NODE_W + ACTION_H_GAP);
}

function childRuns(parentId: string, children: StepLike[], flowLinks: FlowLink[]) {
  return groupActionsIntoSiblingRuns(
    children.map((c) => ({
      id: c.id,
      order: c.order,
      actionFlowBranchId: c.actionFlowBranchId,
    })),
    flowLinks,
    parentId
  ).map((run) =>
    run.map((a) => children.find((c) => c.id === a.id)!)
  );
}

async function main() {
  const journeyId = process.argv[2] ?? "cmwp1eh740002mu28aqvl1njy";
  const journey = await loadJourneyShell(journeyId);
  if (!journey) {
    console.error("NOT FOUND");
    process.exit(1);
  }
  const flowLinks = await loadStepFlowLinks(journeyId);
  const opportunityByStep = await loadPainOpportunitiesByStep(journeyId);

  const phaseTitles = journey.phases.map((p) => p.title);
  const flat: StepLike[] = journey.phases.flatMap((ph) =>
    ph.steps.map((s) => ({
      id: s.id,
      title: s.title,
      userAction: s.userAction,
      parentStepId: s.parentStepId,
      actionFlowBranchId: s.actionFlowBranchId,
      order: s.order,
      phaseTitle: ph.title,
    }))
  );

  const childrenByParent = new Map<string, StepLike[]>();
  for (const s of flat) {
    if (!s.parentStepId) continue;
    const list = childrenByParent.get(s.parentStepId) ?? [];
    list.push(s);
    childrenByParent.set(s.parentStepId, list);
  }
  for (const [k, v] of childrenByParent) {
    childrenByParent.set(
      k,
      [...v].sort((a, b) => a.order - b.order)
    );
  }

  const roots = flat.filter((s) => !s.parentStepId).sort((a, b) => a.order - b.order);

  const rootMeta = new Map(
    journey.phases.flatMap((ph) =>
      ph.steps
        .filter((s) => !s.parentStepId)
        .map((s) => {
          const pain = [...s.painPoints].sort((a, b) => b.severity - a.severity)[0];
          const goal =
            s.feelings.find((f) => f.title === "Experience goal")?.freeText?.trim() ?? "";
          const opp =
            opportunityByStep.get(s.id) ?? pain?.opportunity ?? "";
          return [
            s.id,
            {
              phase: ph.title,
              title: s.title,
              goal,
              pain: pain?.description ?? "",
              severity: pain?.severity ?? 0,
              opportunity: opp,
            },
          ] as const;
        })
    )
  );

  const colWidths = new Map<string, number>();
  for (const phaseTitle of phaseTitles) {
    let maxContent = NODE_W;
    for (const root of roots.filter((r) => r.phaseTitle === phaseTitle)) {
      const children = childrenByParent.get(root.id) ?? [];
      const runs = childRuns(root.id, children, flowLinks);
      for (const run of runs) {
        maxContent = Math.max(maxContent, runWidthPx(run.length));
      }
    }
    colWidths.set(phaseTitle, maxContent + PHASE_GAP_PX);
  }

  type NodeOut = {
    id: string;
    kind: "root" | "action";
    x: number;
    y: number;
    w: number;
    h: number;
    text: string;
    phaseTitle: string;
  };
  const nodes: NodeOut[] = [];
  const laneEdges: { from: string; to: string }[] = [];
  const phaseEdges: { from: string; to: string }[] = [];

  let phaseX = 0;
  const rootIds: string[] = [];

  for (const phaseTitle of phaseTitles) {
    const colW = colWidths.get(phaseTitle) ?? NODE_W + PHASE_GAP_PX;
    let columnY = 0;

    for (const root of roots.filter((r) => r.phaseTitle === phaseTitle)) {
      const meta = rootMeta.get(root.id)!;
      const rootText = [
        meta.phase,
        "",
        meta.title,
        "",
        `Goal · ${meta.goal}`,
        "",
        `Friction · ${meta.severity}`,
        meta.pain,
        "",
        "Opportunity",
        meta.opportunity,
      ].join("\n");

      nodes.push({
        id: root.id,
        kind: "root",
        x: phaseX,
        y: columnY,
        w: NODE_W,
        h: ROOT_H,
        text: rootText,
        phaseTitle,
      });
      rootIds.push(root.id);

      let childY = columnY + ROOT_H + MAP_STACK_GAP_PX;
      const children = childrenByParent.get(root.id) ?? [];
      const runs = childRuns(root.id, children, flowLinks);

      for (const run of runs) {
        let prevId: string | null = null;
        run.forEach((child, index) => {
          const x = phaseX + index * (NODE_W + ACTION_H_GAP);
          const text = `User action\n${child.userAction || child.title}`;
          nodes.push({
            id: child.id,
            kind: "action",
            x,
            y: childY,
            w: NODE_W,
            h: ACTION_H,
            text,
            phaseTitle,
          });
          if (prevId) laneEdges.push({ from: prevId, to: child.id });
          prevId = child.id;
        });
        childY += ACTION_H + MAP_STACK_GAP_PX;
      }

      const bottom = Math.max(childY, columnY + ROOT_H);
      columnY = bottom + MAP_STACK_GAP_PX;
    }

    phaseX += colW;
  }

  for (let i = 0; i < rootIds.length - 1; i++) {
    phaseEdges.push({ from: rootIds[i]!, to: rootIds[i + 1]! });
  }

  const insights = {
    coverageLabel: "Rich coverage",
    kpis: {
      phases: phaseTitles.length,
      steps: roots.length,
      actions: flat.filter((s) => s.parentStepId).length,
    },
    hotspots: roots.map((r) => {
      const m = rootMeta.get(r.id)!;
      return {
        severity: m.severity,
        phase: m.phase,
        snippet: m.pain.slice(0, 80),
      };
    }),
  };

  const out = {
    title: journey.title,
    journeyId,
    originX: 400,
    originY: 400,
    mapWidth: phaseX,
    nodes,
    laneEdges,
    phaseEdges,
    insights,
  };

  const outPath = process.argv[3];
  const json = JSON.stringify(out);
  if (outPath) {
    const fs = await import("node:fs");
    fs.writeFileSync(outPath, json, "utf8");
    console.error(`Wrote ${outPath} (${json.length} bytes)`);
  } else {
    console.log(json);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});