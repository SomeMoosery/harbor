import type { Sql } from 'postgres';
import { NotFoundError } from '@harbor/errors';
import type { AskSnapshot, AskSnapshotId } from '../../public/types/index.js';

interface AskSnapshotRow {
  id: string;
  owner_type: string;
  owner_id: string;
  ask_text: string;
  derived_constraints: Record<string, unknown>;
  buyer_context: Record<string, unknown>;
  attachments: unknown[];
  hash: string;
  created_at: Date;
}

export class AskSnapshotResource {
  constructor(private readonly sql: Sql) {}

  async create(data: Omit<AskSnapshot, 'id' | 'createdAt'>): Promise<AskSnapshot> {
    const [row] = await this.sql<AskSnapshotRow[]>`
      INSERT INTO ask_snapshots (
        owner_type, owner_id, ask_text, derived_constraints, buyer_context, attachments, hash
      ) VALUES (
        ${data.ownerType},
        ${data.ownerId},
        ${data.askText},
        ${data.derivedConstraints as any},
        ${data.buyerContext as any},
        ${data.attachments as any},
        ${data.hash}
      )
      RETURNING *
    `;

    return this.mapRow(row);
  }

  async findById(id: AskSnapshotId): Promise<AskSnapshot> {
    const [row] = await this.sql<AskSnapshotRow[]>`
      SELECT * FROM ask_snapshots WHERE id = ${id}
    `;
    if (!row) {
      throw new NotFoundError('AskSnapshot', id);
    }
    return this.mapRow(row);
  }

  private mapRow(row: AskSnapshotRow): AskSnapshot {
    return {
      id: row.id as AskSnapshotId,
      ownerType: row.owner_type,
      ownerId: row.owner_id,
      askText: row.ask_text,
      derivedConstraints: row.derived_constraints,
      buyerContext: row.buyer_context,
      attachments: row.attachments,
      hash: row.hash,
      createdAt: row.created_at.toISOString(),
    };
  }
}
