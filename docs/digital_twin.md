# Activity Digital Twin

The API-backed participant and caregiver Twin views include separate profiles
for all eleven cognitive activities. Completing a consented scored activity
rebuilds the subject's current profile and writes an immutable history version.
Practice and skipped activities do not contribute. Unchanged recomputation does
not create a duplicate history version.

Each activity records its source summary IDs, scoring version, provenance,
first/latest observation times and numeric measurements. The main comparison
uses the median of the first three comparable runs and the median of the last
three, requiring at least six runs so the groups never overlap. This is a product
reference-window rule, not a clinically validated threshold or significance test.
Single-day data is explicitly flagged. A scoring or task configuration change
restarts the comparable sequence, including when a configuration changes back.
Missing values suppress the affected comparison; numbers are never imputed.
Non-finite numbers and booleans are excluded. The latest twenty comparable runs
are exposed for charts and an accessible table. Older single-run comparisons
remain in the compatibility fields and collapsed CPT detail view.
Tasks are never pooled into an invented overall cognitive or clinical score.

The profile extension uses `activity_profiles` and `total_summary_count`.
Existing CPT fields (`summary_count`, `metrics`, `insights`) retain their old
meaning so older clients, reports and CPT trends remain compatible. Existing
stored versions are preserved; the next scored activity creates a v4 snapshot.
Firebase direct mode and demo mode retain their existing CPT profiles.

Authentication, ownership, explicit caregiver relationships and research
consent continue through the existing API boundaries. Records stay in the
existing subject-scoped Firestore paths; no duplicate frontend writes occur.

## Optional private journal

`GET/PATCH/DELETE /api/v1/subjects/{subjectId}/twin-journal` stores one optional
everyday goal (160 characters maximum) and the latest thirty dated check-ins
at `subjects/{subjectId}/digitalTwin/journal`. Check-ins optionally record sleep
hours, stress, distractions and goal progress. Each preserves the goal that was
current when saved. Re-saving a date replaces its check-in; identical retries
do not change the timestamp or duplicate the entry. PATCH merges atomically and
checks current research consent in the same transaction. Goal text and check-in
contents never appear in audit metadata.

All journal endpoints require the participant owner, including reads. Caregiver,
clinician and unrelated participant access is denied. Saving requires consent;
reading and deletion remain available after withdrawal. Participant export
includes the journal, and existing research-data erasure removes it. Journal
data is not incorporated into shared Twin snapshots or clinical scores. No
drafts or participant CPT timelines are written to browser storage. Previously
stored browser CPT timelines are no longer loaded automatically or migrated.

The participant dashboard uses a single activity selector, plain-language
measurement labels, neutral comparisons and optional detail panels. Run-count
badges describe coverage rather than claiming statistical confidence. The
private journal is separate from the caregiver-visible activity profile.

Progress and the Digital Twin read the same activity records but answer
different questions. Progress shows change over repeated scored runs of one
selected activity at a time. The Twin shows the latest descriptive profile for
each activity, its observation coverage, the versioned server profile when
available, and optional context such as journal entries or the latest EEG
summary. Neither view pools different tasks into a combined score.

## Remaining validation

These engineering improvements do not validate task reliability, establish
age-specific norms, prove benefit for ADHD or demonstrate real-world outcome
prediction. Those need a defined protocol, appropriate measures, participant
usability research and independent evaluation. EEG training/serving alignment
and a consented subject-linked EEG ingestion contract remain prerequisites to
multimodal profiles. No questionnaire or clinical cutoff is invented here.

EEG prediction uploads are not currently persisted as consented subject-linked
observations, so EEG and webcam data are excluded. Connecting them requires
an explicit observation ingestion/storage contract. This Twin is descriptive,
not a learned model, diagnosis, treatment recommendation or validated outcome.
