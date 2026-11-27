import type { CanvasStep } from "@/components/journey/JourneyCanvas";
import type { DiscoveryStepOption } from "@/lib/discovery/flattenJourneySteps";
import type { MapEngagement } from "@/lib/journey/mapEngagementTypes";
import {
  engagementKeyForAction,
  engagementKeyForOpportunity,
  engagementKeysForOpportunityLookup,
  stableTextKey,
} from "@/lib/journey/mapEngagementKeys";

function normalizeScopeMatchText(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Exact bullet identity for scope picks (no prefix / substring matching). */
function findCanvasOpportunityBullet(rootCanvas: CanvasStep, clickedText: string): string | null {
  const items = rootCanvas.painOpportunityItems ?? [];
  const trimmed = clickedText.trim();
  const exact = items.find((item) => item.trim() === trimmed);
  if (exact) return exact.trim();
  const norm = normalizeScopeMatchText(trimmed);
  const normHit = items.find((item) => normalizeScopeMatchText(item) === norm);
  return normHit?.trim() ?? null;
}

export type DiscoveryScopeKind = "pain" | "opportunity" | "step" | "action";

export type DiscoveryScopeTarget = {
  id: string;
  kind: DiscoveryScopeKind;
  /** Root phase step id for references */
  rootStepId: string;
  /** Step or action id (anchor for the requirement) */
  stepId: string;
  painId?: string;
  phaseTitle: string;
  stepTitle: string;
  label: string;
  painDescription?: string;
  opportunityText?: string;
  userAction?: string | null;
  severity?: number;
  facilitatorHearted?: boolean;
  facilitatorNotes?: string[];
};

function rootForStep(stepId: string, canvasSteps: CanvasStep[]): string {
  const byId = new Map(canvasSteps.map((s) => [s.id, s]));
  let cur = byId.get(stepId);
  while (cur?.parentStepId) {
    cur = byId.get(cur.parentStepId);
  }
  return cur?.id ?? stepId;
}

function rootStepOption(
  rootStepId: string,
  stepOptions: DiscoveryStepOption[]
): DiscoveryStepOption | undefined {
  return stepOptions.find((s) => s.id === rootStepId && s.kind === "step");
}

/** Candidates the user can add while a map card is focused. */
function facilitatorMetaForPain(
  painId: string,
  mapEngagement?: MapEngagement
): Pick<DiscoveryScopeTarget, "facilitatorHearted" | "facilitatorNotes"> {
  if (!mapEngagement) return {};
  const facilitatorNotes = mapEngagement.commentsByPainId[painId]?.map((c) => c.body) ?? [];
  return {
    facilitatorHearted: Boolean(mapEngagement.heartedByPainId[painId]),
    facilitatorNotes: facilitatorNotes.length ? facilitatorNotes : undefined,
  };
}

export function enrichScopeTargetWithEngagement(
  t: DiscoveryScopeTarget,
  mapEngagement?: MapEngagement
): DiscoveryScopeTarget {
  if (!mapEngagement) return t;
  if (t.kind === "pain" && t.painId) {
    return { ...t, ...facilitatorMetaForPain(t.painId, mapEngagement) };
  }
  if (t.kind === "opportunity" && t.opportunityText && t.rootStepId) {
    return { ...t, ...facilitatorMetaForOpportunityBullet(t.rootStepId, t.opportunityText, mapEngagement) };
  }
  if (t.kind === "action") {
    return { ...t, ...facilitatorMetaForAnchorKey(engagementKeyForAction(t.stepId), mapEngagement) };
  }
  return t;
}

function facilitatorMetaForAnchorKey(
  key: string,
  mapEngagement?: MapEngagement
): Pick<DiscoveryScopeTarget, "facilitatorHearted" | "facilitatorNotes"> {
  if (!mapEngagement) return {};
  const facilitatorNotes = mapEngagement.commentsByKey[key]?.map((c) => c.body.trim()).filter(Boolean) ?? [];
  return {
    facilitatorHearted: Boolean(mapEngagement.heartedByKey[key]),
    facilitatorNotes: facilitatorNotes.length ? facilitatorNotes : undefined,
  };
}

function collectOpportunityComments(
  mapEngagement: MapEngagement,
  stepId: string,
  opportunityText: string
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of engagementKeysForOpportunityLookup(stepId, opportunityText)) {
    for (const c of mapEngagement.commentsByKey[key] ?? []) {
      const body = c.body.trim();
      if (!body || seen.has(body)) continue;
      seen.add(body);
      out.push(body);
    }
  }
  return out;
}

function facilitatorMetaForOpportunityBullet(
  rootStepId: string,
  opportunityText: string,
  mapEngagement?: MapEngagement
): Pick<DiscoveryScopeTarget, "facilitatorHearted" | "facilitatorNotes"> {
  if (!mapEngagement) return {};
  const facilitatorNotes = collectOpportunityComments(mapEngagement, rootStepId, opportunityText);
  const hearted = engagementKeysForOpportunityLookup(rootStepId, opportunityText).some(
    (key) => mapEngagement.heartedByKey[key]
  );
  return {
    facilitatorHearted: hearted || undefined,
    facilitatorNotes: facilitatorNotes.length ? facilitatorNotes : undefined,
  };
}

function quotePromptString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function scopeTargetsForFocus(
  focusStepId: string | null,
  stepOptions: DiscoveryStepOption[],
  canvasSteps: CanvasStep[],
  mapEngagement?: MapEngagement
): DiscoveryScopeTarget[] {
  if (!focusStepId) return [];
  const byId = new Map(canvasSteps.map((s) => [s.id, s]));
  const focusedCanvas = byId.get(focusStepId);
  if (!focusedCanvas) return [];

  const rootStepId = rootForStep(focusStepId, canvasSteps);
  const rootOpt = rootStepOption(rootStepId, stepOptions);
  const rootCanvas = byId.get(rootStepId);
  const out: DiscoveryScopeTarget[] = [];

  if (rootOpt && rootCanvas) {
    out.push({
      id: `step:${rootStepId}`,
      kind: "step",
      rootStepId,
      stepId: rootStepId,
      phaseTitle: rootOpt.phaseTitle,
      stepTitle: rootOpt.title,
      label: `Whole phase card · ${rootOpt.title}`,
    });

    for (const pain of rootOpt.pains) {
      const desc = pain.description.trim();
      if (!desc) continue;
      out.push({
        id: `pain:${pain.id}`,
        kind: "pain",
        rootStepId,
        stepId: rootStepId,
        painId: pain.id,
        phaseTitle: rootOpt.phaseTitle,
        stepTitle: rootOpt.title,
        label: `Friction · ${desc.slice(0, 72)}${desc.length > 72 ? "…" : ""}`,
        painDescription: desc,
        severity: pain.severity,
        opportunityText: pain.opportunity?.trim() || undefined,
        ...facilitatorMetaForPain(pain.id, mapEngagement),
      });
      const oppOnPain = pain.opportunity?.trim();
      if (oppOnPain) {
        out.push({
          id: `pain-opp:${pain.id}`,
          kind: "opportunity",
          rootStepId,
          stepId: rootStepId,
          painId: pain.id,
          phaseTitle: rootOpt.phaseTitle,
          stepTitle: rootOpt.title,
          label: `Opportunity (on pain) · ${oppOnPain.slice(0, 64)}${oppOnPain.length > 64 ? "…" : ""}`,
          painDescription: desc,
          opportunityText: oppOnPain,
        });
      }
    }

    for (const text of rootCanvas.painOpportunityItems ?? []) {
      const t = text.trim();
      if (!t) continue;
      out.push({
        id: `opp-bullet:${rootStepId}:${stableTextKey(t)}`,
        kind: "opportunity",
        rootStepId,
        stepId: rootStepId,
        phaseTitle: rootOpt.phaseTitle,
        stepTitle: rootOpt.title,
        label: `Opportunity · ${t.slice(0, 72)}${t.length > 72 ? "…" : ""}`,
        opportunityText: t,
        ...facilitatorMetaForAnchorKey(engagementKeyForOpportunity(rootStepId, t), mapEngagement),
      });
    }
  }

  if (focusedCanvas.parentStepId) {
    const actionOpt = stepOptions.find((s) => s.id === focusStepId && s.kind === "action");
    if (actionOpt) {
      const ua = actionOpt.userAction || actionOpt.title;
      out.push({
        id: `action:${focusStepId}`,
        kind: "action",
        rootStepId,
        stepId: focusStepId,
        phaseTitle: actionOpt.phaseTitle,
        stepTitle: rootOpt?.title ?? actionOpt.title,
        label: `User action · ${ua.slice(0, 72)}${ua.length > 72 ? "…" : ""}`,
        userAction: actionOpt.userAction,
        ...facilitatorMetaForAnchorKey(engagementKeyForAction(focusStepId), mapEngagement),
      });
    }
  }

  return out;
}

export function matchScopeTargetFromPainText(
  stepId: string,
  text: string,
  stepOptions: DiscoveryStepOption[],
  canvasSteps: CanvasStep[],
  mapEngagement?: MapEngagement
): DiscoveryScopeTarget | null {
  const built = scopeTargetFromPainBullet(stepId, text, stepOptions, canvasSteps, mapEngagement);
  if (!built) return null;
  const candidates = scopeTargetsForFocus(stepId, stepOptions, canvasSteps, mapEngagement);
  return candidates.find((c) => c.id === built.id) ?? built;
}

export function matchScopeTargetFromOpportunityText(
  stepId: string,
  text: string,
  stepOptions: DiscoveryStepOption[],
  canvasSteps: CanvasStep[],
  mapEngagement?: MapEngagement
): DiscoveryScopeTarget | null {
  const built = scopeTargetFromOpportunityBullet(stepId, text, stepOptions, canvasSteps, mapEngagement);
  if (!built) return null;
  const candidates = scopeTargetsForFocus(stepId, stepOptions, canvasSteps, mapEngagement);
  return candidates.find((c) => c.id === built.id) ?? built;
}

/** When map click text is not in focus list yet, still add the exact bullet to scope. */
export function scopeTargetFromOpportunityBullet(
  stepId: string,
  text: string,
  stepOptions: DiscoveryStepOption[],
  canvasSteps: CanvasStep[],
  mapEngagement?: MapEngagement
): DiscoveryScopeTarget | null {
  const rootStepId = rootForStep(stepId, canvasSteps);
  const rootOpt = rootStepOption(rootStepId, stepOptions);
  const rootCanvas = canvasSteps.find((s) => s.id === rootStepId);
  if (!rootOpt || !rootCanvas) return null;
  const canonical = findCanvasOpportunityBullet(rootCanvas, text);
  if (!canonical) return null;
  return {
    id: `opp-bullet:${rootStepId}:${stableTextKey(canonical)}`,
    kind: "opportunity",
    rootStepId,
    stepId: rootStepId,
    phaseTitle: rootOpt.phaseTitle,
    stepTitle: rootOpt.title,
    label: `Opportunity · ${canonical.slice(0, 72)}${canonical.length > 72 ? "…" : ""}`,
    opportunityText: canonical,
    ...facilitatorMetaForAnchorKey(engagementKeyForOpportunity(rootStepId, canonical), mapEngagement),
  };
}

export function scopeTargetFromPainBullet(
  stepId: string,
  text: string,
  stepOptions: DiscoveryStepOption[],
  canvasSteps: CanvasStep[],
  mapEngagement?: MapEngagement
): DiscoveryScopeTarget | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const rootStepId = rootForStep(stepId, canvasSteps);
  const rootOpt = rootStepOption(rootStepId, stepOptions);
  if (!rootOpt) return null;
  const norm = normalizeScopeMatchText(trimmed);
  const pain =
    rootOpt.pains.find((p) => p.description.trim() === trimmed) ??
    rootOpt.pains.find((p) => normalizeScopeMatchText(p.description) === norm);
  if (!pain) return null;
  const desc = pain.description.trim();
  return {
    id: `pain:${pain.id}`,
    kind: "pain",
    rootStepId,
    stepId: rootStepId,
    painId: pain.id,
    phaseTitle: rootOpt.phaseTitle,
    stepTitle: rootOpt.title,
    label: `Friction · ${desc.slice(0, 72)}${desc.length > 72 ? "…" : ""}`,
    painDescription: desc,
    severity: pain.severity,
    opportunityText: pain.opportunity?.trim() || undefined,
    ...facilitatorMetaForPain(pain.id, mapEngagement),
  };
}

export type DiscoveryScopeGroup = {
  id: string;
  targets: DiscoveryScopeTarget[];
  /** Short label for the scope sidebar */
  summary: string;
};

/** One selected scope item → one discovery requirement (no auto-merge). */
export function groupScopeTargets(targets: DiscoveryScopeTarget[]): DiscoveryScopeGroup[] {
  return targets.map((t) => ({
    id: `group:${t.id}`,
    targets: [t],
    summary: t.label,
  }));
}

export function discoveryRequirementCount(targets: DiscoveryScopeTarget[]): number {
  return targets.length;
}

export function formatScopeForPrompt(targets: DiscoveryScopeTarget[]): string {
  if (!targets.length) return "";
  const groups = groupScopeTargets(targets);

  const lines = groups.map((g, i) => {
    const t = g.targets[0]!;
    const header = `${i + 1}. **${t.kind}** — Phase \`${t.phaseTitle}\` · ${t.stepTitle}`;
    const parts: string[] = [header];

    if (t.kind === "pain") {
      parts.push(`   - Friction: ${t.painDescription ?? ""}`);
      if (t.severity != null) parts.push(`   - Pain severity: ${t.severity}/5`);
      if (t.painId) parts.push(`   - \`references.painId\`: \`${t.painId}\``);
    }
    if (t.kind === "opportunity") {
      parts.push(`   - Opportunity: ${t.opportunityText ?? ""}`);
    }
    if (t.kind === "action") {
      parts.push(`   - User action: ${t.userAction ?? ""}`);
    }
    if (t.kind === "step") {
      parts.push(`   - Whole phase column card (all friction/opportunity on this step)`);
    }
    if (t.facilitatorHearted) {
      parts.push(`   - Facilitator hearted on map: yes (prioritize in synthesis)`);
    }
    if (t.facilitatorNotes?.length) {
      parts.push(`   - **Facilitator comments** (must inform this requirement):`);
      for (let n = 0; n < t.facilitatorNotes.length; n++) {
        parts.push(`     ${n + 1}. ${quotePromptString(t.facilitatorNotes[n]!)}`);
      }
    }

    parts.push(`   - \`references.stepId\`: \`${t.rootStepId}\` (root: \`${t.rootStepId}\`)`);
    if (t.kind === "action") {
      parts.push(`   - Action step id: \`${t.stepId}\``);
    }

    return parts.filter(Boolean).join("\n");
  });

  return `## User-selected discovery scope (mandatory)

The facilitator chose these map anchors in the app. **Generate requirements only for the numbered items below** — do not pick other pains or opportunities from the map.

${targets.length} scope item(s) → **${groups.length} requirement(s)** (one per selection).

${lines.join("\n\n")}

Rules for this pass:
- Emit **exactly one requirement + one user story per numbered item** above.
- **Friction** and **opportunity** rows are independent unless the facilitator selected only one row — do not combine separate scope lines into a single requirement.
- For an **opportunity-only** row, ground the requirement in that opportunity and map context; link \`painId\` only when the map ties it to a specific friction.
- Every \`references\` block must use the \`stepId\` / \`painId\` from that row. Root phase \`stepId\` for phase pains; use the **action** \`stepId\` only when the row is \`action\`.
- Weave **facilitator comments** on each row and in the map-comments section into \`researchEvidence\`, \`constraints\`, \`successCriteria\`, and acceptance criteria — they are workshop evidence, not optional flavor text.
- **Hearted** anchors are facilitator-prioritized — bias priority and emphasis accordingly.`;
}

/** All facilitator comments on phases touched by the current scope (including anchors not individually selected). */
export function formatFacilitatorCommentsForPrompt(
  mapEngagement: MapEngagement,
  scope: DiscoveryScopeTarget[],
  stepOptions: DiscoveryStepOption[],
  canvasSteps: CanvasStep[]
): string {
  const rootIds = [...new Set(scope.map((t) => t.rootStepId))];
  const sections: string[] = [];

  for (const rootId of rootIds) {
    const opt = stepOptions.find((s) => s.id === rootId && s.kind === "step");
    const canvas = canvasSteps.find((s) => s.id === rootId);
    if (!opt) continue;

    const phaseLines: string[] = [];

    for (const pain of opt.pains) {
      for (const c of mapEngagement.commentsByPainId[pain.id] ?? []) {
        const body = c.body.trim();
        if (!body) continue;
        const snippet = pain.description.trim().slice(0, 64);
        phaseLines.push(
          `- **Friction** · ${snippet}${pain.description.length > 64 ? "…" : ""} (\`painId\` \`${pain.id}\`): ${quotePromptString(body)}`
        );
      }
    }

    for (const text of canvas?.painOpportunityItems ?? []) {
      const trimmed = text.trim();
      if (!trimmed) continue;
      for (const body of collectOpportunityComments(mapEngagement, rootId, trimmed)) {
        phaseLines.push(
          `- **Opportunity** · ${trimmed.slice(0, 64)}${trimmed.length > 64 ? "…" : ""}: ${quotePromptString(body)}`
        );
      }
    }

    if (phaseLines.length) {
      sections.push(
        `### Phase \`${opt.phaseTitle}\` · ${opt.title} (\`stepId\` \`${rootId}\`)\n${phaseLines.join("\n")}`
      );
    }
  }

  if (!sections.length) return "";

  return `## Facilitator map comments (mandatory)

Workshop comments on **scoped phases**. Attribute each comment to the friction or opportunity it sits on. Use them in the matching requirement (or the closest scoped item on that phase).

${sections.join("\n\n")}`;
}