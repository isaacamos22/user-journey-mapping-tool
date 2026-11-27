"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { updateDiscoveryUserStory } from "@/lib/actions/journey";
import { DiscoverySection } from "@/components/discovery/DiscoverySection";
import { DiscoveryDetailHeader } from "@/components/discovery/DiscoveryDetailHeader";
import { DiscoveryDetailRail } from "@/components/discovery/DiscoveryDetailRail";
import { DiscoveryFieldHintLayer } from "@/components/discovery/DiscoveryFieldHintLayer";
import { discoveryFieldHint } from "@/lib/discovery/discoveryFieldHint";
import type { DiscoveryMapPreview } from "@/components/discovery/DiscoveryMapReferenceModal";
import { useDiscoveryAutosave } from "@/components/discovery/useDiscoveryAutosave";
import type { DiscoveryStepOption } from "@/lib/discovery/flattenJourneySteps";
import { cn } from "@/lib/utils";
import type { UserStoryBody } from "@/lib/discovery/discoveryText";
import { USER_STORY_SECTIONS, formatFullUserStory } from "@/lib/discovery/discoveryText";

export function UserStoryDiscoveryCard({
  journeyId,
  record,
  steps,
  mapPreview,
  onMetaChange,
  parentRequirement,
  onCloseViewer,
  enterVariant = "default",
}: {
  journeyId: string;
  record: { id: string; title: string; status: string; body: UserStoryBody };
  steps: DiscoveryStepOption[];
  mapPreview?: DiscoveryMapPreview | null;
  onMetaChange?: (id: string, patch: { title?: string }) => void;
  parentRequirement?: { tag: string; title: string; onOpen: () => void };
  onCloseViewer?: () => void;
  enterVariant?: "default" | "genie";
}) {
  const [body, setBody] = useState(record.body);
  const [title, setTitle] = useState(record.title);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, start] = useTransition();

  useEffect(() => {
    setBody(record.body);
    setTitle(record.title);
  }, [record.id]);

  const persist = useCallback(() => {
    const nextBody = { ...body, title };
    setSaveState("saving");
    start(async () => {
      try {
        await updateDiscoveryUserStory(journeyId, record.id, {
          title,
          bodyJson: JSON.stringify(nextBody),
        });
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 1200);
      } catch {
        setSaveState("error");
      }
    });
  }, [body, title, journeyId, record.id, start]);

  useDiscoveryAutosave(persist, [body, title]);

  const patch = (p: Partial<UserStoryBody>) => setBody((b) => ({ ...b, ...p }));
  const full = formatFullUserStory({ ...body, title });

  return (
    <article
      className={cn(
        "discovery-sheet discovery-sheet--subhead discovery-sheet--scroll-split discovery-doc-enter rounded-lg",
        enterVariant === "genie" && "discovery-doc-enter--genie"
      )}
    >
      <DiscoveryDetailHeader
        eyebrow="UX user story"
        title={`[UX] ${title}`}
        copyText={full}
        saveState={saveState}
        parentRequirement={parentRequirement}
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
            copyText={USER_STORY_SECTIONS[0].text({ ...body, title })}
          >
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                onMetaChange?.(record.id, { title: e.target.value });
              }}
              className="discovery-sheet-field w-full text-sm"
            />
          </DiscoverySection>

          <DiscoverySection
            anchorId="description"
            title="Description"
            copyText={USER_STORY_SECTIONS[1].text(body)}
          >
            <input
              value={body.asA}
              onChange={(e) => patch({ asA: e.target.value })}
              placeholder="As a…"
              className="discovery-sheet-field mb-2 w-full text-sm"
              {...discoveryFieldHint("As a…")}
            />
            <input
              value={body.iWant}
              onChange={(e) => patch({ iWant: e.target.value })}
              placeholder="I want…"
              className="discovery-sheet-field mb-2 w-full text-sm"
              {...discoveryFieldHint("I want…")}
            />
            <input
              value={body.soThat}
              onChange={(e) => patch({ soThat: e.target.value })}
              placeholder="So that…"
              className="discovery-sheet-field w-full text-sm"
              {...discoveryFieldHint("So that…")}
            />
          </DiscoverySection>

          {(
            [
              { sectionId: "design", field: "designReference", label: "Design reference" },
              { sectionId: "flow", field: "userFlow", label: "User flow / scenario" },
              { sectionId: "scope", field: "scope", label: "Scope" },
              { sectionId: "dependencies", field: "dependencies", label: "Dependencies" },
              { sectionId: "edgeCases", field: "edgeCases", label: "Edge cases" },
              { sectionId: "acceptance", field: "acceptanceCriteria", label: "Acceptance criteria" },
            ] as const
          ).map(({ sectionId, field, label }) => {
            const section = USER_STORY_SECTIONS.find((s) => s.id === sectionId)!;
            return (
              <DiscoverySection
                key={field}
                anchorId={sectionId}
                title={label}
                copyText={section.text({ ...body, title })}
              >
                <textarea
                  value={body[field]}
                  onChange={(e) => patch({ [field]: e.target.value } as Partial<UserStoryBody>)}
                  rows={3}
                  className="discovery-sheet-field min-h-[5.5rem] w-full resize-y text-sm"
                  {...discoveryFieldHint(`${label} — add detail for this section`)}
                />
              </DiscoverySection>
            );
          })}
        </DiscoveryFieldHintLayer>

        <DiscoveryDetailRail toc={USER_STORY_SECTIONS.map((s) => ({ id: s.id, label: s.label }))} />
      </div>
    </article>
  );
}