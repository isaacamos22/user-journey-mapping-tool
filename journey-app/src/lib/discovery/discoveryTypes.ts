export type DiscoveryReference = {
  personaId?: string;
  personaName?: string;
  personaRole?: string | null;
  personaGoals?: string | null;
  personaFrustrations?: string | null;
  stepId?: string;
  stepTitle?: string;
  userAction?: string | null;
  stepKind?: "step" | "action";
  phaseTitle?: string;
  parentStepTitle?: string;
  painId?: string;
  painDescription?: string;
  painSeverity?: number;
  opportunity?: string | null;
  evidence?: string | null;
  touchpoint?: {
    module?: string | null;
    screen?: string | null;
    panel?: string | null;
    dialog?: string | null;
  };
};