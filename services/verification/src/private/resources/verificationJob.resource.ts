import type { Sql } from 'postgres';
import { NotFoundError } from '@harbor/errors';
import type {
  VerificationJob,
  VerificationJobId,
  VerificationJobStatus,
  EvaluationSpecId,
  NormalizedDeliveryId,
  EvidenceBundleId,
} from '../../public/types/index.js';

interface JobRow {
  id: string;
  spec_id: string;
  delivery_id: string;
  evidence_bundle_id: string;
  status: string;
  error_json: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export class VerificationJobResource {
  constructor(private readonly sql: Sql) {}

  async create(data: Omit<VerificationJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<VerificationJob> {
    const [row] = await this.sql<JobRow[]>`
      INSERT INTO verification_jobs (spec_id, delivery_id, evidence_bundle_id, status, error_json)
      VALUES (${data.specId}, ${data.deliveryId}, ${data.evidenceBundleId}, ${data.status}, ${null})
      RETURNING *
    `;
    return this.mapRow(row);
  }

  async updateStatus(id: VerificationJobId, status: VerificationJobStatus, error?: Record<string, unknown>): Promise<void> {
    await this.sql`
      UPDATE verification_jobs
      SET status = ${status},
          error_json = ${error ?? null},
          updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  async findById(id: VerificationJobId): Promise<VerificationJob> {
    const [row] = await this.sql<JobRow[]>`
      SELECT * FROM verification_jobs WHERE id = ${id}
    `;
    if (!row) throw new NotFoundError('VerificationJob', id);
    return this.mapRow(row);
  }

  private mapRow(row: JobRow): VerificationJob {
    return {
      id: row.id as VerificationJobId,
      specId: row.spec_id as EvaluationSpecId,
      deliveryId: row.delivery_id as NormalizedDeliveryId,
      evidenceBundleId: row.evidence_bundle_id as EvidenceBundleId,
      status: row.status as VerificationJobStatus,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
