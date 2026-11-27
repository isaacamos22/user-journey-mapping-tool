import {
  AppWindow,
  ArchiveRestore,
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Compass,
  Crosshair,
  FileSpreadsheet,
  FolderOpen,
  Layers,
  LayoutGrid,
  Link2,
  MonitorPlay,
  RefreshCw,
  SlidersHorizontal,
  Workflow,
  type LucideIcon,
} from "lucide-react";

type IconRule = { pattern: RegExp; icon: LucideIcon };

/** More specific rules first. */
const ACTION_RULES: IconRule[] = [
  { pattern: /\bcontext selector|wellbore|well\s*→/i, icon: Crosshair },
  { pattern: /\bmenu\.drillnet|drillnet menu/i, icon: AppWindow },
  { pattern: /\bactivity folder|activity variant/i, icon: FolderOpen },
  { pattern: /\breportdaily|report daily|daily html/i, icon: FileSpreadsheet },
  { pattern: /\brecording screen|technical record/i, icon: MonitorPlay },
  { pattern: /\bhole section|casing|lot|fit|survey|plug\b/i, icon: Workflow },
  { pattern: /\bswitch reporting day|next day/i, icon: CalendarClock },
  { pattern: /\bbatch|carry forward|reuse/i, icon: ArchiveRestore },
  { pattern: /\bsliders?|selector/i, icon: SlidersHorizontal },
];

const STEP_TITLE_RULES: IconRule[] = [
  { pattern: /\brecognize|reporting duty|ddr\b/i, icon: BadgeCheck },
  { pattern: /\borient|choose today|plan the day/i, icon: Compass },
  { pattern: /\bopen or create daily|bind.*day|reporting day/i, icon: Link2 },
  { pattern: /\bcapture|operations|chained|cross-screen/i, icon: Workflow },
  { pattern: /\bcarry forward|batch-update|next report/i, icon: RefreshCw },
];

const PHASE_RULES: IconRule[] = [
  { pattern: /\bprerequisite|context\b/i, icon: Crosshair },
  { pattern: /\bplan the day|screens\b/i, icon: LayoutGrid },
  { pattern: /\bopen and bind|daily\b/i, icon: CalendarDays },
  { pattern: /\bexecute|validate\b/i, icon: Workflow },
  { pattern: /\bclose|reuse|improve\b/i, icon: ArchiveRestore },
];

function matchRules(text: string, rules: IconRule[]): LucideIcon | null {
  for (const { pattern, icon } of rules) {
    if (pattern.test(text)) return icon;
  }
  return null;
}

/** Pick a lucide icon from step / phase wording (title-first for roots, action-first for children). */
export function resolveStepMapIcon(input: {
  title: string;
  phaseTitle: string;
  userAction?: string | null;
  isChild: boolean;
}): LucideIcon {
  const actionText = (input.userAction || input.title).trim();
  const titleText = input.title.trim();
  const phaseText = input.phaseTitle.trim();

  if (input.isChild) {
    return (
      matchRules(actionText, ACTION_RULES) ??
      matchRules(titleText, ACTION_RULES) ??
      matchRules(phaseText, PHASE_RULES) ??
      ClipboardList
    );
  }

  return (
    matchRules(titleText, STEP_TITLE_RULES) ??
    matchRules(phaseText, PHASE_RULES) ??
    matchRules(titleText + " " + actionText, ACTION_RULES) ??
    Layers
  );
}