import type { Sql } from 'postgres';
import { NotFoundError } from '@harbor/errors';
import type {
  VerificationReport,
  VerificationReportId,
  VerificationDecision,
  VerificationJobId,
  EvaluationSpecId,
} from '../../public/types/index.js';

interface ReportRow {
  id: string;
  job_id: string;
  spec_id: string;
  report_json: Record<string, unknown>;
  decision: string;
  score: number;
  gates_passed: boolean;
  hash: string;
  created_at: Date;
}

export class VerificationReportResource {
  constructor(private readonly sql: Sql) {}

  async create(data: Omit<VerificationReport, 'id' | 'createdAt'>): Promise<VerificationReport> {
    const [row] = await this.sql<ReportRow[]>`
      INSERT INTO verification_reports (
        job_id, spec_id, report_json, decision, score, gates_passed, hash
      ) VALUES (
        ${data.jobId},
        ${data.specId},
        ${data.report as any},
        ${data.decision},
        ${data.score},
        ${data.gatesPassed},
        ${data.hash}
      )
      RETURNING *
    `;
    return this.mapRow(row);
  }

  async findById(id: VerificationReportId): Promise<VerificationReport> {
    const [row] = await this.sql<ReportRow[]>`
      SELECT * FROM verification_reports WHERE id = ${id}
    `;
    if (!row) throw new NotFoundError('VerificationReport', id);
    return this.mapRow(row);
  }

  private mapRow(row: ReportRow): VerificationReport {
    return {
      id: row.id as VerificationReportId,
      jobId: row.job_id as VerificationJobId,
      specId: row.spec_id as EvaluationSpecId,
      decision: row.decision as VerificationDecision,
      score: row.score,
      gatesPassed: row.gates_passed,
      report: row.report_json,
      hash: row.hash,
      createdAt: row.created_at.toISOString(),
    };
  }
}
