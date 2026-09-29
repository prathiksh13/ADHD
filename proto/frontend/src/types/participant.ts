export type Diagnosis = "ADHD" | "Control" | "undetermined" | "unknown";

export type ParticipantStatus = "Active" | "Review" | "Complete" | "Withdrawn";

export type Participant = {
  id: string;
  displayId: string;
  source: "balladeer" | "adhdata";
  age: number;
  gender: "male" | "female";
  diagnosis: Diagnosis;
  diagnosisBasis: string;
  sessionCount: number;
  completedSessions: number;
  lastSession: string | null;
  status: ParticipantStatus;
  devices: string[];
  tasks: string[];
  signalQuality: number;
  behaviorLinked: boolean;
};
