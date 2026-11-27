import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { JourneyLayoutFrame } from "@/components/journey/JourneyLayoutFrame";
import { JourneyShellTitle } from "@/components/journey/JourneyShellTitle";
import { JourneyNavClient } from "@/components/journey/JourneyNavClient";
import { loadJourneyShell } from "@/lib/journey/loadJourney";
import { scoreJourney } from "@/lib/completeness/scoreJourney";
import { buildJourneyInsights } from "@/lib/journey/buildJourneyInsights";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { canRead, getJourneyRole } from "@/lib/rbac";
import { parseImportQualityMeta } from "@/lib/import/importQuality";

export const dynamic = "force-dynamic";

export default async function JourneyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) notFound();
  const role = await getJourneyRole(user.id, id);
  if (!canRead(role)) notFound();
  const journey = await loadJourneyShell(id);
  if (!journey) notFound();

  const importQuality = parseImportQualityMeta(journey.businessContext);

  const completeness = scoreJourney({
    personas: journey.personas,
    phases: journey.phases,
    opportunities: journey.opportunities,
  });

  const insights = buildJourneyInsights({
    sourceNotes: journey.goal,
    personas: journey.personas,
    phases: journey.phases.map((ph) => ({
      id: ph.id,
      title: ph.title,
      steps: ph.steps.map((s) => ({
        id: s.id,
        title: s.title,
        parentStepId: s.parentStepId,
        userAction: s.userAction,
        painPoints: s.painPoints.map((p) => ({
          description: p.description,
          severity: p.severity,
          evidence: p.evidence,
        })),
        feelings: s.feelings.map((f) => ({
          confidence: f.confidence,
          frustration: f.frustration,
          delight: f.delight,
          title: f.title,
        })),
        emotions: s.emotions
          ? {
              confidence: s.emotions.confidence,
              frustration: s.emotions.frustration,
              delight: s.emotions.delight,
            }
          : null,
      })),
    })),
    opportunities: journey.opportunities,
  });

  return (
    <AppShell
      journeyTitle={
        <JourneyShellTitle
          title={journey.title}
          score={completeness.score}
          importQuality={importQuality}
        />
      }
      journeyNav={<JourneyNavClient journeyId={id} layout="header" />}
    >
      <JourneyLayoutFrame
        journeyId={id}
        importQuality={importQuality}
        insights={insights}
        personas={journey.personas.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          tags: p.tags,
          goals: p.goals,
          frustrations: p.frustrations,
        }))}
      >
        {children}
      </JourneyLayoutFrame>
    </AppShell>
  );
}