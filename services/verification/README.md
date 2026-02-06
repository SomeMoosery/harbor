# Harbor Verification Service — Spec

## Purpose
The Verification Service is Harbor’s trust core. It converts ambiguous, natural-language asks into a deterministic, replayable acceptance contract (Evaluation Spec), then verifies seller deliveries against that contract and produces a decision recommendation.

Goals:
- Deterministic, replayable verification (same inputs + toolchain -> same outputs).
- Immutable Evaluation Specs frozen pre-bid and explicitly accepted.
- Evidence-backed verification with auditability.
- Decision outputs: accept / reject / escalate.

Non-goals (MVP):
- Public external API access (internal service only).
- Partial accept or remediation loops.
- LLM-based inspection gates.

## Service Overview
- Name: `verification`
- Port: `3006`
- Visibility: internal-only (service-to-service)
- API style: resource-oriented
- Execution model: async jobs with in-process queue
- LLM use: Translator + Normalizer only

## Core Artifacts
All artifacts are first-class tables (UUID IDs with branded types in TS).

1) Ask Snapshot
- Frozen record of ask text, inferred constraints, buyer context, attachments, timestamp, hash.

2) Evaluation Spec (Acceptance Contract)
- JSON + JSON Schema, versioned and hashed.
- Includes deliverable structure, dimensions, evidence policy, thresholds, operator versions.

3) Normalized Delivery
- Canonical JSON representation with schema version + hash.

4) Evidence Bundle
- Separate artifact containing evidence items.
- Evidence types: `url_snapshot` (metadata only) and `file`.

5) Verification Report
- Per-check outcomes, scores, gates, decision, operator traces, references.

## Pipeline
1. Freeze ask -> Ask Snapshot
2. Compile acceptance criteria -> Evaluation Spec
3. Receive seller delivery + evidence
4. Normalize delivery -> Normalized Delivery
5. Execute checks -> Verification Report
6. Apply decision policy -> accept/reject/escalate

## Modules
### Translator (Spec Compiler)
- LLM with templates -> JSON spec
- Validate against JSON Schema
- If confidence low or invalid -> `REVIEW_REQUIRED`
- Review flow: buyer can edit raw JSON and resubmit
- On acceptance -> `FROZEN`

### Normalizer
- Canonicalize delivery to structured JSON
- No scoring or judgment
- Persist normalized output

### Inspector (Verifier)
- Deterministic operators only
- Gates: structure validity, required evidence
- Scored checks: structure, freshness, evidence coverage
- Produces per-check results and trace summaries

### Adjudicator
- Weighted average scoring
- Decision thresholds:
  - accept >= 0.8
  - reject <= 0.5
  - else escalate

## Data Model (Tables)

### `ask_snapshots`
- `id`
- `owner_type` (enum)
- `owner_id` (string)
- `ask_text`
- `derived_constraints` (json)
- `buyer_context` (json)
- `attachments` (json)
- `created_at`
- `hash`

### `evaluation_specs`
- `id`
- `ask_snapshot_id`
- `status` (`DRAFT`, `REVIEW_REQUIRED`, `FROZEN`)
- `spec_json`
- `schema_version`
- `hash`
- `translator_model_id`
- `translator_prompt_hash`
- `created_at`

### `spec_acceptance_events`
- `id`
- `spec_id`
- `actor_type` (`buyer`, `seller`)
- `actor_id`
- `accepted_at`

### `normalized_deliveries`
- `id`
- `spec_id`
- `delivery_raw` (json)
- `normalized_json`
- `schema_version`
- `created_at`
- `hash`

### `evidence_bundles`
- `id`
- `spec_id`
- `delivery_id`
- `created_at`

### `evidence_items`
- `id`
- `bundle_id`
- `type` (`url_snapshot`, `file`)
- `uri`
- `content_hash`
- `observed_at`
- `metadata_json`

### `verification_jobs`
- `id`
- `spec_id`
- `delivery_id`
- `evidence_bundle_id`
- `status` (`QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `REVIEW_REQUIRED`)
- `created_at`
- `updated_at`
- `error_json`

### `verification_reports`
- `id`
- `job_id`
- `spec_id`
- `report_json`
- `decision` (`accept`, `reject`, `escalate`)
- `score`
- `gates_passed`
- `created_at`
- `hash`

### `operator_registry`
- `id`
- `name`
- `version`
- `code_hash`
- `status` (`ACTIVE`, `DEPRECATED`)
- `created_at`

## Evaluation Spec (JSON)
Core fields:
- `deliverable_type`: `ranked_table | memo`
- `structure_schema`: JSON schema for deliverable
- `dimensions`: structure, freshness, evidence
- `evidence_policy`: claim IDs, evidence types, recency window
- `gates`: required checks
- `scored_checks`: weights
- `decision_policy`: thresholds
- `operator_versions`
- `translator_metadata`: model ID + prompt hash
- `hash`, `schema_version`, `status`

Defaults:
- Weights: structure 0.5, freshness 0.25, evidence 0.25
- Thresholds: accept >= 0.8, reject <= 0.5
- Recency: no default; must be set explicitly to enforce

## Deliverable Types (MVP)
### Ranked Table
Required fields per item:
- entity (name/id)
- rank
- key metrics
- evidence refs (claim IDs)

### Memo
Required sections:
- title
- summary
- findings
- sources/evidence refs

## Evidence
- Evidence items stored in object storage
- URL evidence: metadata only (URL + observedAt + hash)
- Recency proof: seller-provided `observedAt`
- Claim mapping: explicit claim IDs provided by seller

Limits (configurable via env):
- 25MB per file
- 200MB per job

Retention: indefinite (MVP)

## Operator Registry
- Static code registry with semver
- DB stores: version + code hash + status
- Specs reference operator versions

## APIs (Internal)
Resource-oriented endpoints:
- `POST /ask-snapshots`
- `POST /evaluation-specs`
- `PATCH /evaluation-specs/:id`
- `POST /evaluation-specs/:id/accept`
- `POST /evidence-items` (multipart upload)
- `POST /verification-jobs`
- `GET /verification-jobs/:id`
- `GET /verification-reports/:id`

Auth: `X-Agent-Id` / `X-User-Id` (same pattern as Tendering).

## Tendering Integration
- Ask creation calls Translator to compile/freeze spec before ask is created.
- Ask creation blocks until spec is ready (no timeout).
- If `REVIEW_REQUIRED`, ask creation fails; buyer edits spec in verification service, then retry.

Tendering data changes:
- Ask: add `spec_id`, `spec_status`
- Bid: add `verification_job_id`, `verification_status`, `verification_decision`
- Ask statuses: add `PENDING_SPEC`, `REVIEW`

Delivery flow:
- Tendering submits delivery + evidence -> verification job
- Tendering polls verification for status/report

## Security & Access
- Access to artifacts: buyer + seller + admin
- No extra encryption requirements in MVP beyond existing storage/db defaults

## Testing
Unit:
- JSON schema validation + canonical hash
- Decision policy scoring thresholds
- Claim/evidence mapping validation
- Operator registry version enforcement

Integration:
- Ask -> spec compile -> freeze
- Review flow: low confidence -> buyer edits -> freeze
- Delivery -> verification job -> report -> decision
- Tendering polling of verification status
