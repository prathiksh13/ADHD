import { PublicHeader } from "./public-header";
import { PublicFooter } from "./public-footer";

/**
 * Public site chrome.
 *
 * Applied per page rather than through a route group so the public research
 * page at `/research` and the researcher portal at `/research/*` can share a
 * segment without a nested layout conflict.
 */
export function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </>
  );
}
