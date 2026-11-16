import type { ProcessingStageId } from "@/types";
export interface ProcessingStageDefinition { id: ProcessingStageId; label: string; description: string; simulated: boolean }
export const processingStages: ProcessingStageDefinition[] = [
  { id: "received", label: "Recording received", description: "The analysis service has received the recording.", simulated: false },
  { id: "validated", label: "Recording validated", description: "Recording format and channel information have been checked.", simulated: false },
  { id: "preprocessing", label: "Signal preprocessing", description: "The analysis service prepares the signal for feature extraction.", simulated: false },
  { id: "features", label: "Feature extraction", description: "Signal features are calculated from the recording.", simulated: false },
  { id: "review", label: "Analysis review", description: "Review the available analysis result.", simulated: false },
];
