import type { RequirementTemplate, UserStoryTemplate } from "@/lib/ai/synthesis";
import type { DiscoveryReference } from "@/lib/discovery/discoveryTypes";

export type RequirementBody = RequirementTemplate & { references?: DiscoveryReference };

export type UserStoryBody = UserStoryTemplate & { references?: DiscoveryReference };

export const REQUIREMENT_SECTIONS: {
  id: string;
  label: string;
  text: (b: RequirementBody) => string;
}[] = [
  {
    id: "title",
    label: "Title",
    text: (b) => `[${b.tag}] ${b.title}`,
  },
  {
    id: "problem",
    label: "Problem statement",
    text: (b) => b.problemStatement,
  },
  {
    id: "businessContext",
    label: "Business context",
    text: (b) =>
      `Business context\n${b.businessContext}\n\nWhy is this important?\n${b.whyImportant}\n\nBusiness objective\n${b.businessObjective}\n\nPriority: ${b.priority}`,
  },
  {
    id: "hypothesis",
    label: "Hypothesis",
    text: (b) =>
      `If… ${b.hypothesis.if}\nThen… ${b.hypothesis.then}\nResulting in… ${b.hypothesis.resultingIn}`,
  },
  {
    id: "locations",
    label: "Locations",
    text: (b) =>
      [
        `Module: ${b.locations.module ?? "TBD"}`,
        `Screen: ${b.locations.screen ?? "TBD"}`,
        `Panel: ${b.locations.panel ?? "TBD"}`,
        `Dialog: ${b.locations.dialog ?? "TBD"}`,
        `Workflow step: ${b.locations.workflowStep ?? "TBD"}`,
      ].join("\n"),
  },
  {
    id: "research",
    label: "Research & evidence",
    text: (b) =>
      (b.researchEvidence.length ? b.researchEvidence : ["TBD"]).map((e) => `• ${e}`).join("\n"),
  },
  {
    id: "inScope",
    label: "In scope",
    text: (b) => b.inScope,
  },
  {
    id: "outScope",
    label: "Out of scope",
    text: (b) => b.outScope,
  },
  {
    id: "constraints",
    label: "Constraints",
    text: (b) => b.constraints,
  },
  {
    id: "edgeCases",
    label: "Edge cases",
    text: (b) => b.edgeCases,
  },
  {
    id: "success",
    label: "Success criteria",
    text: (b) => b.successCriteria,
  },
  {
    id: "acceptance",
    label: "Acceptance criteria (high-level)",
    text: (b) => b.acceptanceCriteria,
  },
];

export const USER_STORY_SECTIONS: {
  id: string;
  label: string;
  text: (b: UserStoryBody) => string;
}[] = [
  {
    id: "title",
    label: "Title",
    text: (b) => `[UX] ${b.title}`,
  },
  {
    id: "description",
    label: "Description",
    text: (b) => `As a ${b.asA}\nI want ${b.iWant}\nSo that ${b.soThat}`,
  },
  {
    id: "design",
    label: "Design reference",
    text: (b) => b.designReference,
  },
  {
    id: "flow",
    label: "User flow / scenario",
    text: (b) => b.userFlow,
  },
  {
    id: "scope",
    label: "Scope",
    text: (b) => b.scope,
  },
  {
    id: "dependencies",
    label: "Dependencies",
    text: (b) => b.dependencies,
  },
  {
    id: "edgeCases",
    label: "Edge cases",
    text: (b) => b.edgeCases,
  },
  {
    id: "acceptance",
    label: "Acceptance criteria",
    text: (b) => b.acceptanceCriteria,
  },
];

export function formatFullRequirement(body: RequirementBody): string {
  return REQUIREMENT_SECTIONS.map((s) => `${s.label}\n${s.text(body)}`).join("\n\n");
}

export function formatFullUserStory(body: UserStoryBody): string {
  return USER_STORY_SECTIONS.map((s) => `${s.label}\n${s.text(body)}`).join("\n\n");
}

export function parseRequirementBody(raw: string): RequirementBody {
  try {
    return JSON.parse(raw) as RequirementBody;
  } catch {
    return defaultRequirementBody();
  }
}

export function parseUserStoryBody(raw: string): UserStoryBody {
  try {
    return JSON.parse(raw) as UserStoryBody;
  } catch {
    return defaultUserStoryBody();
  }
}

export function defaultRequirementBody(): RequirementBody {
  return {
    tag: "UX",
    title: "New requirement",
    problemStatement: "",
    businessContext: "",
    whyImportant: "",
    businessObjective: "",
    priority: "Medium",
    hypothesis: { if: "", then: "", resultingIn: "" },
    locations: {},
    researchEvidence: [],
    inScope: "",
    outScope: "",
    constraints: "",
    edgeCases: "",
    successCriteria: "",
    acceptanceCriteria: "",
    references: {},
  };
}

export function defaultUserStoryBody(title = "New user story"): UserStoryBody {
  return {
    title,
    asA: "user",
    iWant: "",
    soThat: "",
    designReference: "",
    userFlow: "",
    scope: "",
    dependencies: "",
    edgeCases: "",
    acceptanceCriteria: "",
    references: {},
  };
}