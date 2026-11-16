export interface TwinJournalEntry {
  day: string;
  sleepHours: number | null;
  stress: "low" | "medium" | "high" | null;
  distractions: "few" | "some" | "many" | null;
  goalProgress: "not_attempted" | "partly" | "achieved" | null;
  goal: string | null;
}

export interface TwinJournal {
  goal: string | null;
  entries: TwinJournalEntry[];
  updatedAt: string | null;
}
