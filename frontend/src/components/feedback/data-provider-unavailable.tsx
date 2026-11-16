import { Alert } from "@/components/ui/alert";
import { getFrontendConfig, type FrontendConfig } from "@/lib/config/frontend-config";
export function DataProviderUnavailable({ config = getFrontendConfig() }: { config?: FrontendConfig }) {
  return <Alert tone="danger" title="Account connection is not configured">{config.valid ? "Firebase must be configured before signing in." : config.error}</Alert>;
}
