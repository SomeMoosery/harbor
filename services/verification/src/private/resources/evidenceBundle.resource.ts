import type { Sql } from 'postgres';
import { NotFoundError } from '@harbor/errors';
import type {
  EvidenceBundle,
  EvidenceBundleId,
  EvidenceItem,
  EvidenceItemId,
  EvidenceItemType,
  NormalizedDeliveryId,
  EvaluationSpecId,
} from '../../public/types/index.js';

interface EvidenceBundleRow {
  id: string;
  spec_id: string;
  delivery_id: string;
  created_at: Date;
}

interface EvidenceItemRow {
  id: string;
  bundle_id: string;
  type: string;
  uri: string;
  content_hash: string;
  observed_at: Date | null;
  metadata_json: Record<string, unknown>;
}

export class EvidenceBundleResource {
  constructor(private readonly sql: Sql) {}

  async create(bundle: Omit<EvidenceBundle, 'id' | 'createdAt' | 'items'>): Promise<EvidenceBundle> {
    const [row] = await this.sql<EvidenceBundleRow[]>`
      INSERT INTO evidence_bundles (spec_id, delivery_id)
      VALUES (${bundle.specId}, ${bundle.deliveryId})
      RETURNING *
    `;
    return this.mapBundle(row);
  }

  async createItem(data: {
    bundleId: EvidenceBundleId;
    type: EvidenceItemType;
    uri: string;
    contentHash: string;
    observedAt: string | null;
    metadata: Record<string, unknown>;
  }): Promise<EvidenceItem> {
    const [row] = await this.sql<EvidenceItemRow[]>`
      INSERT INTO evidence_items (bundle_id, type, uri, content_hash, observed_at, metadata_json)
      VALUES (
        ${data.bundleId},
        ${data.type},
        ${data.uri},
        ${data.contentHash},
        ${data.observedAt ? new Date(data.observedAt) : null},
        ${data.metadata as any}
      )
      RETURNING *
    `;
    return this.mapItem(row);
  }

  async listItems(bundleId: EvidenceBundleId): Promise<EvidenceItem[]> {
    const rows = await this.sql<EvidenceItemRow[]>`
      SELECT * FROM evidence_items WHERE bundle_id = ${bundleId}
    `;
    return rows.map((row) => this.mapItem(row));
  }

  async findBundle(id: EvidenceBundleId): Promise<EvidenceBundle> {
    const [row] = await this.sql<EvidenceBundleRow[]>`
      SELECT * FROM evidence_bundles WHERE id = ${id}
    `;
    if (!row) throw new NotFoundError('EvidenceBundle', id);
    const bundle = this.mapBundle(row);
    const items = await this.listItems(id);
    return { ...bundle, items };
  }

  private mapBundle(row: EvidenceBundleRow): EvidenceBundle {
    return {
      id: row.id as EvidenceBundleId,
      specId: row.spec_id as EvaluationSpecId,
      deliveryId: row.delivery_id as NormalizedDeliveryId,
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapItem(row: EvidenceItemRow): EvidenceItem {
    return {
      id: row.id as EvidenceItemId,
      bundleId: row.bundle_id as EvidenceBundleId,
      type: row.type as EvidenceItemType,
      uri: row.uri,
      contentHash: row.content_hash,
      observedAt: row.observed_at ? row.observed_at.toISOString() : null,
      metadata: row.metadata_json,
    };
  }
}
