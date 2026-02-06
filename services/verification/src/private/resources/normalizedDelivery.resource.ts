import type { Sql } from 'postgres';
import { NotFoundError } from '@harbor/errors';
import type {
  NormalizedDelivery,
  NormalizedDeliveryId,
  EvaluationSpecId,
} from '../../public/types/index.js';

interface NormalizedDeliveryRow {
  id: string;
  spec_id: string;
  delivery_raw: Record<string, unknown>;
  normalized_json: Record<string, unknown>;
  schema_version: string;
  hash: string;
  created_at: Date;
}

export class NormalizedDeliveryResource {
  constructor(private readonly sql: Sql) {}

  async create(data: Omit<NormalizedDelivery, 'id' | 'createdAt'>): Promise<NormalizedDelivery> {
    const [row] = await this.sql<NormalizedDeliveryRow[]>`
      INSERT INTO normalized_deliveries (
        spec_id, delivery_raw, normalized_json, schema_version, hash
      ) VALUES (
        ${data.specId},
        ${data.deliveryRaw as any},
        ${data.normalized as any},
        ${data.schemaVersion},
        ${data.hash}
      )
      RETURNING *
    `;
    return this.mapRow(row);
  }

  async findById(id: NormalizedDeliveryId): Promise<NormalizedDelivery> {
    const [row] = await this.sql<NormalizedDeliveryRow[]>`
      SELECT * FROM normalized_deliveries WHERE id = ${id}
    `;
    if (!row) throw new NotFoundError('NormalizedDelivery', id);
    return this.mapRow(row);
  }

  private mapRow(row: NormalizedDeliveryRow): NormalizedDelivery {
    return {
      id: row.id as NormalizedDeliveryId,
      specId: row.spec_id as EvaluationSpecId,
      deliveryRaw: row.delivery_raw,
      normalized: row.normalized_json,
      schemaVersion: row.schema_version,
      hash: row.hash,
      createdAt: row.created_at.toISOString(),
    };
  }
}
