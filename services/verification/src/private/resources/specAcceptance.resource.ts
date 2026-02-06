import type { Sql } from 'postgres';
import type { EvaluationSpecId } from '../../public/types/index.js';

interface AcceptanceRow {
  id: string;
  spec_id: string;
  actor_type: string;
  actor_id: string;
  accepted_at: Date;
}

export class SpecAcceptanceResource {
  constructor(private readonly sql: Sql) {}

  async add(specId: EvaluationSpecId, actorType: 'buyer' | 'seller', actorId: string): Promise<void> {
    await this.sql`
      INSERT INTO spec_acceptance_events (spec_id, actor_type, actor_id)
      VALUES (${specId}, ${actorType}, ${actorId})
      ON CONFLICT DO NOTHING
    `;
  }

  async hasActor(specId: EvaluationSpecId, actorType: 'buyer' | 'seller'): Promise<boolean> {
    const [row] = await this.sql<{ count: string }[]>`
      SELECT count(*)::int as count
      FROM spec_acceptance_events
      WHERE spec_id = ${specId}
        AND actor_type = ${actorType}
    `;
    return Number(row?.count ?? 0) > 0;
  }
}
