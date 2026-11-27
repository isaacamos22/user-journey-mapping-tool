"use client";

import { cn } from "@/lib/utils";
import { opportunitySurface, painSeverityLabel, painSeveritySurface } from "@/lib/charts/chartSemantics";
import { resolveStepMapIcon } from "@/lib/journey/stepMapIcon";
import { MapActionEngagementToolbar } from "@/components/journey/MapActionEngagementToolbar";
import {
  MapFrictionBulletList,
  type MapFrictionBullet,
} from "@/components/journey/MapFrictionBulletList";
import { useMapCanvas } from "@/components/journey/mapCanvasContext";
import { engagementKeyForOpportunity } from "@/lib/journey/mapEngagementKeys";
import type { MapCanvasEngagement } from "@/components/journey/JourneyCanvas";
import {
  MapTextWithHighlight,
  mapTextMatchesHighlight,
} from "@/components/journey/JourneyMapNodeBody.shared";
import { MapExperienceGoalBlock } from "@/components/journey/MapExperienceGoalBlock";
import { MapFacilitatorScrollSection } from "@/components/journey/MapFacilitatorScrollSection";

const wrapText = "min-w-0 max-w-full whitespace-normal break-words";

export function JourneyMapNodeBody({
  stepId,
  isChild,
  focused,
}: {
  stepId: string;
  isChild: boolean;
  focused: boolean;
}) {
  const ctx = useMapCanvas();
  const s = ctx?.getStep(stepId);
  if (!s || !ctx) return null;

  const hasChildActions = !isChild && ctx.childCount(stepId) > 0;
  const highlight = focused ? ctx.focusHighlightText : null;
  const mapEngagement = ctx.mapEngagement;
  const scopePick = ctx.discoveryScopePick;
  const detailLevel = ctx.detailLevel ?? "detail";
  const isDetail = detailLevel === "detail";
  const isOverview = detailLevel === "overview";
  const showFacilitatorChips = !isChild && !isOverview;

  return (
    <div
      className={cn(
        "journey-map-node",
        isChild ? "journey-map-node--nested" : "journey-map-node--root",
        focused && "journey-map-node--focused"
      )}
      data-map-node-detail={detailLevel}
    >
      {!isChild ? (
        <div className="journey-map-step-header">
          {(() => {
            const Icon = resolveStepMapIcon({
              title: s.title,
              phaseTitle: s.phaseTitle,
              userAction: s.userAction,
              isChild: false,
            });
            return (
              <div className="journey-map-step-icon" aria-hidden>
                <Icon className="h-[18px] w-[18px] shrink-0 stroke-[2.25]" />
              </div>
            );
          })()}
          {!isOverview ? (
            <span className="journey-map-phase-pill">{s.phaseTitle}</span>
          ) : null}
        </div>
      ) : null}
      {isChild ? (
        <MapActionEngagementToolbar
          stepId={s.id}
          journeyId={mapEngagement?.journeyId}
          engagement={mapEngagement?.state}
          onEngagementChange={mapEngagement?.onChange}
        >
          <div className="journey-map-step-icon journey-map-step-icon--nested" aria-hidden>
            {(() => {
              const Icon = resolveStepMapIcon({
                title: s.title,
                phaseTitle: s.phaseTitle,
                userAction: s.userAction,
                isChild: true,
              });
              return <Icon className="h-4 w-4 stroke-[2.25]" />;
            })()}
          </div>
          {!isOverview ? <p className="journey-map-action-label">User action</p> : null}
          <p className={`journey-map-title ${wrapText}`}>
            <MapTextWithHighlight text={s.userAction || s.title} highlight={highlight} />
          </p>
          {isDetail && s.userAction && s.title !== s.userAction ? (
            <p className={`journey-map-body mt-1 journey-map-tier-foldable ${wrapText}`}>
              <MapTextWithHighlight text={s.title} highlight={highlight} />
            </p>
          ) : null}
          {isDetail && s.touchpoint ? (
            <p
              className={`journey-map-body mt-1 text-foreground/75 journey-map-tier-foldable ${wrapText}`}
            >
              Place · {s.touchpoint}
            </p>
          ) : null}
        </MapActionEngagementToolbar>
      ) : (
        <>
          <p className={`journey-map-title ${wrapText}`}>
            <MapTextWithHighlight text={s.title} highlight={highlight} />
          </p>
          {isDetail && !hasChildActions && s.userAction && s.userAction !== s.title ? (
            <p className={`journey-map-body mt-1.5 journey-map-tier-foldable ${wrapText}`}>
              <MapTextWithHighlight text={s.userAction} highlight={highlight} />
            </p>
          ) : null}
          {isDetail && s.touchpoint ? (
            <p className={`journey-map-body mt-1 journey-map-tier-foldable ${wrapText}`}>
              Touchpoint · {s.touchpoint}
            </p>
          ) : null}
          {isDetail && s.experienceGoal ? (
            <div className="journey-map-tier-foldable">
              <MapExperienceGoalBlock experienceGoal={s.experienceGoal} highlight={highlight} />
            </div>
          ) : null}
        </>
      )}
      {showFacilitatorChips ? (
        <>
          <PainChip
            severity={s.painSeverity ?? 0}
            items={s.painFrictionItems}
            frictionBullets={s.painFrictionBullets}
            highlightText={highlight}
            stepId={s.id}
            onPickPain={scopePick ? (text) => scopePick.onPickPain(s.id, text) : undefined}
            mapEngagement={mapEngagement}
          />
          {(s.painOpportunityItems?.length ?? 0) > 0 ? (
            <OpportunityChip
              items={s.painOpportunityItems ?? []}
              highlightText={highlight}
              stepId={s.id}
              onPickOpportunity={
                scopePick ? (text) => scopePick.onPickOpportunity(s.id, text) : undefined
              }
              mapEngagement={mapEngagement}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function PainChip({
  severity,
  items,
  frictionBullets,
  highlightText,
  stepId,
  onPickPain,
  mapEngagement,
}: {
  severity: number;
  items?: string[];
  frictionBullets?: MapFrictionBullet[];
  highlightText?: string | null;
  stepId?: string;
  onPickPain?: (text: string) => void;
  mapEngagement?: MapCanvasEngagement;
}) {
  if (severity < 2) return null;
  const bullets: MapFrictionBullet[] = frictionBullets?.length
    ? frictionBullets
    : (items?.map((s) => s.trim()).filter(Boolean).map((description, i) => ({
        id: `text:${i}:${description.slice(0, 24)}`,
        description,
      })) ?? []);
  if (!bullets.length) return null;
  const surface = painSeveritySurface(severity);
  const revealFriction =
    Boolean(highlightText?.trim()) &&
    bullets.some((b) => mapTextMatchesHighlight(b.description, highlightText!));
  return (
    <MapFacilitatorScrollSection
      backgroundColor={surface.background}
      labelColor={surface.label}
      count={bullets.length}
      defaultOpen={revealFriction}
      label={
        <>
          Friction · {painSeverityLabel(severity)} ({severity}/5)
        </>
      }
    >
      <MapFrictionBulletList
        bullets={bullets}
        journeyId={mapEngagement?.journeyId}
        stepId={stepId}
        engagement={mapEngagement?.state}
        onEngagementChange={mapEngagement?.onChange}
        highlightText={highlightText}
        onPickItem={onPickPain}
        bodyForItem={(text, emph) =>
          emph ? <mark className="journey-map-text-highlight">{text}</mark> : text
        }
      />
    </MapFacilitatorScrollSection>
  );
}

function OpportunityChip({
  items,
  highlightText,
  stepId,
  onPickOpportunity,
  mapEngagement,
}: {
  items: string[];
  highlightText?: string | null;
  stepId?: string;
  onPickOpportunity?: (text: string) => void;
  mapEngagement?: MapCanvasEngagement;
}) {
  if (!items.length) return null;
  const bullets: MapFrictionBullet[] = items
    .map((s) => s.trim())
    .filter(Boolean)
    .map((description) => ({
      id: stepId ? engagementKeyForOpportunity(stepId, description) : `text:${description.slice(0, 24)}`,
      description,
    }));
  const revealOpportunity =
    Boolean(highlightText?.trim()) &&
    bullets.some((b) => mapTextMatchesHighlight(b.description, highlightText!));
  return (
    <MapFacilitatorScrollSection
      className="journey-map-opportunity"
      backgroundColor={opportunitySurface.background}
      labelColor={opportunitySurface.label}
      count={bullets.length}
      defaultOpen={revealOpportunity}
      label={<>Opportunity</>}
    >
      <MapFrictionBulletList
        bullets={bullets}
        journeyId={mapEngagement?.journeyId}
        stepId={stepId}
        engagement={mapEngagement?.state}
        onEngagementChange={mapEngagement?.onChange}
        highlightText={highlightText}
        onPickItem={onPickOpportunity}
        toolbarLabel="Opportunity actions"
        bodyForItem={(text, emph) =>
          emph ? <mark className="journey-map-text-highlight">{text}</mark> : text
        }
      />
    </MapFacilitatorScrollSection>
  );
}