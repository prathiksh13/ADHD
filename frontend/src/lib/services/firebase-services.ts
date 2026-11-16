import { cognitiveActivities } from "@/data/activities";
import { ServiceUnavailableError } from "@/lib/api-client";
import type { ActivityService, ParticipantService } from "./contracts";
export const firebaseActivityService: ActivityService = {
  async listActivities() { return cognitiveActivities; },
  async getActivity(activityId) { return cognitiveActivities.find((activity) => activity.id === activityId); },
};
export const firebaseParticipantService: ParticipantService = {
  async getDashboard() { throw new ServiceUnavailableError("Use the signed-in Firebase account dashboard.", "unsupported"); },
  async listSessions() { throw new ServiceUnavailableError("Use the signed-in Firebase activity and session records.", "unsupported"); },
};
