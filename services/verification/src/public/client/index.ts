import { z } from 'zod';
import { getServiceUrl } from '@harbor/config/ports';
import {
  askSnapshotSchema,
  evaluationSpecSchema,
  verificationJobSchema,
  verificationReportSchema,
  normalizedDeliverySchema,
  evidenceBundleSchema,
} from '../schemas/index.js';
import type {
  AskSnapshot,
  EvaluationSpec,
  EvidenceBundle,
  VerificationJob,
  VerificationReport,
  NormalizedDelivery,
} from '../types/index.js';
const createNormalizedDeliverySchema = z.object({
  specId: z.string().uuid(),
  deliveryRaw: z.record(z.any()),
  normalized: z.record(z.any()),
  schemaVersion: z.string().optional(),
});

const createEvidenceBundleSchema = z.object({
  specId: z.string().uuid(),
  deliveryId: z.string().uuid(),
  items: z
    .array(
      z.object({
        type: z.enum(['url_snapshot', 'file']),
        uri: z.string(),
        contentHash: z.string().optional(),
        observedAt: z.string().datetime().nullable().optional(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .optional(),
});

export class VerificationClient {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? getServiceUrl('verification');
  }

  async createAskSnapshot(data: unknown): Promise<AskSnapshot> {
    const res = await fetch(`${this.baseUrl}/ask-snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create ask snapshot: ${res.statusText}`);
    return askSnapshotSchema.parse(await res.json());
  }

  async createEvaluationSpec(data: unknown): Promise<EvaluationSpec> {
    const res = await fetch(`${this.baseUrl}/evaluation-specs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create evaluation spec: ${res.statusText}`);
    return evaluationSpecSchema.parse(await res.json());
  }

  async updateEvaluationSpec(id: string, data: unknown): Promise<EvaluationSpec> {
    const res = await fetch(`${this.baseUrl}/evaluation-specs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to update evaluation spec: ${res.statusText}`);
    return evaluationSpecSchema.parse(await res.json());
  }

  async acceptEvaluationSpec(id: string): Promise<{ specId: string; acceptedBy: string }> {
    const res = await fetch(`${this.baseUrl}/evaluation-specs/${id}/accept`, { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to accept evaluation spec: ${res.statusText}`);
    return z.object({ specId: z.string(), acceptedBy: z.string() }).parse(await res.json());
  }

  async createVerificationJob(data: unknown): Promise<VerificationJob> {
    const res = await fetch(`${this.baseUrl}/verification-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Failed to create verification job: ${res.statusText}`);
    return verificationJobSchema.parse(await res.json());
  }

  async createNormalizedDelivery(data: unknown): Promise<NormalizedDelivery> {
    const parsed = createNormalizedDeliverySchema.parse(data);
    const res = await fetch(`${this.baseUrl}/normalized-deliveries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    });
    if (!res.ok) throw new Error(`Failed to create normalized delivery: ${res.statusText}`);
    return normalizedDeliverySchema.parse(await res.json());
  }

  async createEvidenceBundle(data: unknown): Promise<EvidenceBundle> {
    const parsed = createEvidenceBundleSchema.parse(data);
    const res = await fetch(`${this.baseUrl}/evidence-bundles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    });
    if (!res.ok) throw new Error(`Failed to create evidence bundle: ${res.statusText}`);
    return evidenceBundleSchema.parse(await res.json());
  }

  async getVerificationJob(id: string): Promise<VerificationJob> {
    const res = await fetch(`${this.baseUrl}/verification-jobs/${id}`);
    if (!res.ok) throw new Error(`Failed to get verification job: ${res.statusText}`);
    return verificationJobSchema.parse(await res.json());
  }

  async getVerificationReport(id: string): Promise<VerificationReport> {
    const res = await fetch(`${this.baseUrl}/verification-reports/${id}`);
    if (!res.ok) throw new Error(`Failed to get verification report: ${res.statusText}`);
    return verificationReportSchema.parse(await res.json());
  }
}

export const verificationClient = new VerificationClient();
