import { ServiceUnavailableError } from "@/lib/api-client";
export function getRemoteIntegrationError(service: string, operation: string) {
  return new ServiceUnavailableError(`${service}.${operation} requires a supported integration. Use the signed-in Firebase workspace.`, "unsupported");
}
