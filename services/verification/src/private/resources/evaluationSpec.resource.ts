import type { Sql } from 'postgres';
import { NotFoundError } from '@harbor/errors';
import type {
  EvaluationSpec,
  EvaluationSpecId,
  AskSnapshotId,
  EvaluationSpecStatus,
} from '../../public/types/index.js';

interface EvaluationSpecRow {
  id: string;
  ask_snapshot_id: string;
  status: string;
  deliverable_type: string;
  spec_json: Record<string, unknown>;
  schema_version: string;
  hash: string;
  translator_model_id: string;
  translator_prompt_hash: string;
  created_at: Date;
}

export class EvaluationSpecResource {
  constructor(private readonly sql: Sql) {}

  async create(data: Omit<EvaluationSpec, 'id' | 'createdAt'>): Promise<EvaluationSpec> {
    const deliverableType = (data.deliverableType as any) ?? (data.spec as any)?.deliverableType ?? 'ranked_table';
    const [row] = await this.sql<EvaluationSpecRow[]>`
      INSERT INTO evaluation_specs (
        ask_snapshot_id, status, deliverable_type, spec_json, schema_version, hash,
        translator_model_id, translator_prompt_hash
      ) VALUES (
        ${data.askSnapshotId},
        ${data.status},
        ${deliverableType},
        ${data.spec as any},
        ${data.schemaVersion},
        ${data.hash},
        ${data.translatorModelId},
        ${data.translatorPromptHash}
      )
      RETURNING *
    `;
    return this.mapRow(row);
  }

  async update(id: EvaluationSpecId, updates: Partial<Omit<EvaluationSpec, 'id' | 'askSnapshotId' | 'createdAt'>>): Promise<EvaluationSpec> {
    const current = await this.findById(id);
    const merged = {
      status: updates.status ?? current.status,
      spec: (updates.spec ?? current.spec) as Record<string, unknown>,
      schemaVersion: updates.schemaVersion ?? current.schemaVersion,
      hash: updates.hash ?? current.hash,
      translatorModelId: updates.translatorModelId ?? current.translatorModelId,
      translatorPromptHash: updates.translatorPromptHash ?? current.translatorPromptHash,
      deliverableType: (updates.spec as any)?.deliverableType ?? (current.spec as any).deliverableType ?? 'ranked_table',
    };

    const [row] = await this.sql<EvaluationSpecRow[]>`
      UPDATE evaluation_specs
      SET status = ${merged.status},
          deliverable_type = ${merged.deliverableType},
          spec_json = ${merged.spec as any},
          schema_version = ${merged.schemaVersion},
          hash = ${merged.hash},
          translator_model_id = ${merged.translatorModelId},
          translator_prompt_hash = ${merged.translatorPromptHash}
      WHERE id = ${id}
      RETURNING *
    `;
    return this.mapRow(row);
  }

  async setStatus(id: EvaluationSpecId, status: EvaluationSpecStatus): Promise<void> {
    await this.sql`
      UPDATE evaluation_specs SET status = ${status}
      WHERE id = ${id}
    `;
  }

  async findById(id: EvaluationSpecId): Promise<EvaluationSpec> {
    const [row] = await this.sql<EvaluationSpecRow[]>`
      SELECT * FROM evaluation_specs WHERE id = ${id}
    `;
    if (!row) throw new NotFoundError('EvaluationSpec', id);
    return this.mapRow(row);
  }

  private mapRow(row: EvaluationSpecRow): EvaluationSpec {
    return {
      id: row.id as EvaluationSpecId,
      askSnapshotId: row.ask_snapshot_id as AskSnapshotId,
      status: row.status as EvaluationSpecStatus,
      deliverableType: row.deliverable_type as 'ranked_table' | 'memo',
      spec: row.spec_json,
      schemaVersion: row.schema_version,
      hash: row.hash,
      translatorModelId: row.translator_model_id,
      translatorPromptHash: row.translator_prompt_hash,
      createdAt: row.created_at.toISOString(),
    };
  }
}
