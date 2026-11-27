"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { updateDiscoveryRequirement } from "@/lib/actions/journey";
import { DiscoverySection } from "@/components/discovery/DiscoverySection";
import { DiscoveryDetailHeader } from "@/components/discovery/DiscoveryDetailHeader";
import { DiscoveryDetailRail } from "@/components/discovery/DiscoveryDetailRail";
import { DiscoveryFieldHintLayer } from "@/components/discovery/DiscoveryFieldHintLayer";
import { discoveryFieldHint } from "@/lib/discovery/discoveryFieldHint";
import type { DiscoveryMapPreview } from "@/components/discovery/DiscoveryMapReferenceModal";
import { useDiscoveryAutosave } from "@/components/discovery/useDiscoveryAutosave";
import type { DiscoveryStepOption } from "@/lib/discovery/flattenJourneySteps";
import { cn } from "@/lib/utils";
import type { RequirementBody } from "@/lib/discovery/discoveryText";
import {
  REQUIREMENT_SECTIONS,
  formatFullRequirement,
} from "@/lib/discovery/discoveryText";

export type DiscoveryRequirementRecord = {
  id: string;
  tag: string;
  title: string;
  status: string;
  synthesisBatchId?: string | null;
  body: RequirementBody;
  stories: {
    id: string;
    title: string;
    status: string;
    body: import("@/lib/discovery/discoveryText").UserStoryBody;
  }[];
};

export function RequirementDiscoveryCard({
  journeyId,
  record,
  steps,
  mapPreview,
  onMetaChange,
  onCloseViewer,
  enterVariant = "default",
}: {
  journeyId: string;
  record: DiscoveryRequirementRecord;
  steps: DiscoveryStepOption[];
  mapPreview?: DiscoveryMapPreview | null;
  onMetaChange?: (id: string, patch: Partial<DiscoveryRequirementRecord>) => void;
  onCloseViewer?: () => void;
  enterVariant?: "default" | "genie";
}) {
  const [body, setBody] = useState(record.body);
  const [tag, setTag] = useState(record.tag);
  const [title, setTitle] = useState(record.title);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, start] = useTransition();

  useEffect(() => {
    setBody(record.body);
    setTag(record.tag);
    setTitle(record.title);
  }, [record.id]);

  const persist = useCallback(() => {
    const nextBody = { ...body, tag, title };
    setSaveState("saving");
    start(async () => {
      try {
        await updateDiscoveryRequirement(journeyId, record.id, {
          tag,
          title,
          bodyJson: JSON.stringify(nextBody),
        });
        setSaveState("saved");
        onMetaChange?.(record.id, { tag, title, body: nextBody });
        window.setTimeout(() => setSaveState("idle"), 1200);
      } catch {
        setSaveState("error");
      }
    });
  }, [body, tag, title, journeyId, record.id, onMetaChange, start]);

  useDiscoveryAutosave(persist, [body, tag, title]);

  const patch = (patchBody: Partial<RequirementBody>) =>
    setBody((b) => {
      const next = { ...b, ...patchBody };
      onMetaChange?.(record.id, { body: next, tag, title });
      return next;
    });

  const full = formatFullRequirement({ ...body, tag, title });

  return (
    <article
      className={cn(
        "discovery-sheet discovery-sheet--scroll-split discovery-doc-enter rounded-lg",
        enterVariant === "genie" && "discovery-doc-enter--genie"
      )}
    >
      <DiscoveryDetailHeader
        eyebrow="UX requirement"
        title={`[${tag}] ${title}`}
        copyText={full}
        saveState={saveState}
        sheet
        onCloseViewer={onCloseViewer}
        mapReference={{ references: body.references, steps, mapPreview }}
      />

      <div className="discovery-detail-grid">
        <DiscoveryFieldHintLayer className="discovery-sheet-main min-w-0">
          <DiscoverySection
            compact
            anchorId="title"
            title="Title"
            copyText={REQUIREMENT_SECTIONS[0].text({ ...body, tag, title })}
          >
            <div className="flex w-full flex-wrap gap-2">
              <input
                value={tag}
                onChange={(e) => {
                  setTag(e.target.value);
                  onMetaChange?.(record.id, { tag: e.target.value, title });
                }}
                className="discovery-sheet-field discovery-sheet-field-tag"
                aria-label="Tag"
              />
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  onMetaChange?.(record.id, { title: e.target.value, tag });
                }}
                className="discovery-sheet-field min-w-[12rem] flex-1 font-semibold"
                aria-label="Requirement title"
              />
            </div>
          </DiscoverySection>

          <DiscoverySection
            anchorId="problem"
            title="Problem statement"
            copyText={REQUIREMENT_SECTIONS[1].text(body)}
          >
            <textarea
              value={body.problemStatement}
              onChange={(e) => patch({ problemStatement: e.target.value })}
              rows={3}
              placeholder="Friction from the map — who struggles, where, and what goes wrong"
              className="discovery-sheet-field w-full resize-none text-sm"
              {...discoveryFieldHint(
                "Friction from the map — who struggles, where, and what goes wrong"
              )}
            />
          </DiscoverySection>

          <DiscoverySection
            anchorId="businessContext"
            title="Business context"
            copyText={REQUIREMENT_SECTIONS[2].text({ ...body, tag, title })}
          >
            <textarea
              value={body.businessContext}
              onChange={(e) => patch({ businessContext: e.target.value })}
              rows={2}
              placeholder="Business reason and expected value"
              className="discovery-sheet-field w-full resize-none text-sm mb-2"
              {...discoveryFieldHint("Business reason and expected value")}
            />
            <textarea
              value={body.whyImportant}
              onChange={(e) => patch({ whyImportant: e.target.value })}
              rows={2}
              placeholder="Why is this important?"
              className="discovery-sheet-field w-full resize-none text-sm mb-2"
              {...discoveryFieldHint("Why is this important?")}
            />
            <input
              value={body.businessObjective}
              onChange={(e) => patch({ businessObjective: e.target.value })}
              placeholder="Business objective"
              className="discovery-sheet-field w-full text-sm mb-2"
              {...discoveryFieldHint("Business objective")}
            />
            <select
              value={body.priority}
              onChange={(e) => patch({ priority: e.target.value as RequirementBody["priority"] })}
              className="discovery-sheet-field w-full text-sm"
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </DiscoverySection>

          <DiscoverySection anchorId="hypothesis" title="Hypothesis" copyText={REQUIREMENT_SECTIONS[3].text(body)}>
            <input
              value={body.hypothesis.if}
              onChange={(e) => patch({ hypothesis: { ...body.hypothesis, if: e.target.value } })}
              placeholder="If…"
              className="discovery-sheet-field w-full text-sm mb-2"
              {...discoveryFieldHint("If…")}
            />
            <input
              value={body.hypothesis.then}
              onChange={(e) => patch({ hypothesis: { ...body.hypothesis, then: e.target.value } })}
              placeholder="Then…"
              className="discovery-sheet-field w-full text-sm mb-2"
              {...discoveryFieldHint("Then…")}
            />
            <input
              value={body.hypothesis.resultingIn}
              onChange={(e) => patch({ hypothesis: { ...body.hypothesis, resultingIn: e.target.value } })}
              placeholder="Resulting in…"
              className="discovery-sheet-field w-full text-sm"
              {...discoveryFieldHint("Resulting in…")}
            />
          </DiscoverySection>

          <DiscoverySection anchorId="locations" title="Locations" copyText={REQUIREMENT_SECTIONS[4].text(body)}>
            {(["module", "screen", "panel", "dialog", "workflowStep"] as const).map((key) => {
              const locPlaceholder =
                key === "workflowStep" ? "Workflow step" : key[0].toUpperCase() + key.slice(1);
              return (
              <input
                key={key}
                value={body.locations[key] ?? ""}
                onChange={(e) =>
                  patch({ locations: { ...body.locations, [key]: e.target.value || undefined } })
                }
                placeholder={locPlaceholder}
                className="discovery-sheet-field w-full text-sm mb-2 last:mb-0"
                {...discoveryFieldHint(locPlaceholder)}
              />
            );
            })}
          </DiscoverySection>

          <DiscoverySection
            anchorId="research"
            title="Research & evidence"
            copyText={REQUIREMENT_SECTIONS[5].text(body)}
          >
            <textarea
              value={body.researchEvidence.join("\n")}
              onChange={(e) =>
                patch({
                  researchEvidence: e.target.value
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean),
                })
              }
              rows={4}
              placeholder="One source per line (interviews, analytics, visits…)"
              className="discovery-sheet-field w-full resize-none text-sm"
              {...discoveryFieldHint("One source per line (interviews, analytics, visits…)")}
            />
          </DiscoverySection>

          {(
            [
              { sectionId: "inScope", field: "inScope", label: "In scope" },
              { sectionId: "outScope", field: "outScope", label: "Out of scope" },
              { sectionId: "constraints", field: "constraints", label: "Constraints" },
              { sectionId: "edgeCases", field: "edgeCases", label: "Edge cases" },
              { sectionId: "success", field: "successCriteria", label: "Success criteria" },
              { sectionId: "acceptance", field: "acceptanceCriteria", label: "Acceptance criteria (high-level)" },
            ] as const
          ).map(({ sectionId, field, label }) => {
            const section = REQUIREMENT_SECTIONS.find((s) => s.id === sectionId)!;
            return (
              <DiscoverySection
                key={field}
                anchorId={sectionId}
                title={label}
                copyText={section.text({ ...body, tag, title })}
              >
                <textarea
                  value={body[field]}
                  onChange={(e) => patch({ [field]: e.target.value } as Partial<RequirementBody>)}
                  rows={3}
                  className="discovery-sheet-field w-full resize-none text-sm"
                  {...discoveryFieldHint(`${label} — add detail for this section`)}
                />
              </DiscoverySection>
            );
          })}
        </DiscoveryFieldHintLayer>

        <DiscoveryDetailRail toc={REQUIREMENT_SECTIONS.map((s) => ({ id: s.id, label: s.label }))} />
      </div>

      {record.stories.length > 0 ? (
        <footer className="border-t border-border/60 px-6 py-2.5 text-sm text-muted">
          {record.stories.length} user stor{record.stories.length === 1 ? "y" : "ies"} — select one
          in the tree.
        </footer>
      ) : null}
    </article>
  );
}