/**
 * DRAFT PLACEHOLDER research-consent text.
 *
 * This wording has NOT been written or approved by the research team, an ethics
 * board, or legal counsel. It exists only so the consent *mechanism* (explicit
 * grant, versioning, withdrawal, server-side enforcement) can be built and
 * tested. It must be replaced with approved wording, and the version string
 * changed, before any real participant uses this flow. Changing the version
 * makes the backend treat the new text as a new consent record.
 *
 * Guardian/assent handling for children is intentionally NOT implemented here:
 * the backend currently lets only the subject's owner account grant consent.
 */
export const RESEARCH_CONSENT_VERSION = "research-consent-DRAFT-v0";

export const RESEARCH_CONSENT_IS_DRAFT = true;

export const RESEARCH_CONSENT_DRAFT = {
  title: "Research data collection (draft wording)",
  summary:
    "Allow this account to save scored cognitive activity results to the research backend. Optional private goals and daily check-ins are saved only when submitted; EEG summaries require a separate save choice.",
  points: [
    "What is saved: scored cognitive task responses and calculated summaries. Submitted private goals and daily check-ins are owner-only. EEG result summaries require a separate save checkbox.",
    "What is not saved: practice runs, EEG files, webcam video, or any message content.",
    "Results are descriptive research measurements. They are not a diagnosis or a clinical assessment.",
    "You can withdraw consent at any time. Withdrawing stops future saving; it does not by itself delete data that was already saved.",
    "This activity is for research and learning. If the participant is a child, a parent or guardian should review this step with them.",
  ],
  agreementLabel:
    "I have read this draft and agree to save scored CPT results and other cognitive activity results for research, with optional private journal and EEG-summary choices (draft; not approved wording).",
} as const;

/**
 * A fresh key for every grant action. The backend treats an identical
 * (scope, key) as the *same* consent record, even after it was withdrawn, so a
 * reused key could never re-grant consent.
 */
export function newConsentIdempotencyKey(randomUuid: () => string = () => globalThis.crypto.randomUUID()): string {
  return `consent-${randomUuid()}`;
}
