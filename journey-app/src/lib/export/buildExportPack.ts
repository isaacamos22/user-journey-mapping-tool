import JSZip from "jszip";
import type { LoadedJourney } from "@/lib/journey/loadJourney";
import { scoreJourney } from "@/lib/completeness/scoreJourney";
import {
  JOURNEY_EXPORT_PACK_FILENAME,
  buildJourneyExportPackV1,
} from "@/lib/export/journeyPackV1";

export async function buildExportPackZip(
  journey: LoadedJourney,
  extras: {
    requirementsMd?: string;
    storiesMd?: string;
    summaryMd?: string;
  }
): Promise<Buffer> {
  const zip = new JSZip();

  const manifest = `Journey: ${journey.title}
Completeness: ${journey.completenessScore}%
Exported: ${new Date().toISOString()}
`;
  zip.file("README.txt", manifest);
  zip.file(
    JOURNEY_EXPORT_PACK_FILENAME,
    JSON.stringify(buildJourneyExportPackV1(journey), null, 2)
  );
  zip.file("stakeholder-summary.md", extras.summaryMd || buildSummaryMarkdown(journey));
  if (extras.requirementsMd) zip.file("requirements/index.md", extras.requirementsMd);
  if (extras.storiesMd) zip.file("user-stories/index.md", extras.storiesMd);

  const pains = journey.phases.flatMap((p) =>
    p.steps.flatMap((s) =>
      s.painPoints.map((pp) => ({
        phase: p.title,
        step: s.title,
        severity: pp.severity,
        description: pp.description,
      }))
    )
  );
  zip.file(
    "pain-points.csv",
    ["phase,step,severity,description", ...pains.map((p) =>
      `"${p.phase}","${p.step}",${p.severity},"${p.description.replace(/"/g, '""')}"`
    )].join("\n")
  );

  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

function buildSummaryMarkdown(journey: LoadedJourney): string {
  const { score, depth, gaps } = scoreJourney({
    personas: journey.personas,
    phases: journey.phases,
    opportunities: journey.opportunities,
  });
  return `# ${journey.title} — Stakeholder Summary

**Goal:** ${journey.goal ?? "—"}
**Completeness:** ${score}% (${depth})

## Personas
${journey.personas.map((p) => `- **${p.name}** — ${p.role ?? ""}`).join("\n")}

## Journey phases
${journey.phases
  .map(
    (ph) =>
      `### ${ph.title}\n${ph.steps.map((s) => `- ${s.userAction || s.title}`).join("\n")}`
  )
  .join("\n\n")}

## Input quality notes
${gaps.map((g) => `- ${g.message}`).join("\n")}
`;
}