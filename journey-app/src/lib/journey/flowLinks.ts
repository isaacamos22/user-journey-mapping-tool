export type StepFlowLinkRecord = {
  id: string;
  fromStepId: string;
  toStepId: string;
  kind: string;
};

export type FlowLink = Pick<StepFlowLinkRecord, "fromStepId" | "toStepId"> & {
  kind?: string;
};