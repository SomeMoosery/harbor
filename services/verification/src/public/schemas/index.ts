import { z } from 'zod';

export const askSnapshotSchema = z.object({
  id: z.string().uuid(),
  ownerType: z.string(),
  ownerId: z.string(),
  askText: z.string(),
  derivedConstraints: z.record(z.any()),
  buyerContext: z.record(z.any()),
  attachments: z.array(z.any()),
  hash: z.string(),
  createdAt: z.string(),
});

export const evaluationSpecSchema = z.object({
  id: z.string().uuid(),
  askSnapshotId: z.string().uuid(),
  status: z.enum(['DRAFT', 'REVIEW_REQUIRED', 'FROZEN']),
  deliverableType: z.enum(['ranked_table', 'memo']).optional(),
  spec: z.record(z.any()),
  schemaVersion: z.string(),
  hash: z.string(),
  translatorModelId: z.string(),
  translatorPromptHash: z.string(),
  createdAt: z.string(),
});

export const verificationJobSchema = z.object({
  id: z.string().uuid(),
  specId: z.string().uuid(),
  deliveryId: z.string().uuid(),
  evidenceBundleId: z.string().uuid(),
  status: z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'REVIEW_REQUIRED']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const verificationReportSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  specId: z.string().uuid(),
  decision: z.enum(['accept', 'reject', 'escalate']),
  score: z.number(),
  gatesPassed: z.boolean(),
  report: z.record(z.any()),
  hash: z.string(),
  createdAt: z.string(),
});

export const normalizedDeliverySchema = z.object({
  id: z.string().uuid(),
  specId: z.string().uuid(),
  deliveryRaw: z.record(z.any()),
  normalized: z.record(z.any()),
  schemaVersion: z.string(),
  hash: z.string(),
  createdAt: z.string(),
});

export const evidenceItemSchema = z.object({
  id: z.string().uuid(),
  bundleId: z.string().uuid(),
  type: z.enum(['url_snapshot', 'file']),
  uri: z.string(),
  contentHash: z.string(),
  observedAt: z.string().nullable(),
  metadata: z.record(z.any()),
});

export const evidenceBundleSchema = z.object({
  id: z.string().uuid(),
  specId: z.string().uuid(),
  deliveryId: z.string().uuid(),
  createdAt: z.string(),
  items: z.array(evidenceItemSchema).optional(),
});
