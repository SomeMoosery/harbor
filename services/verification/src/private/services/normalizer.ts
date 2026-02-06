import { sha256Canonical } from '../utils/hash.js';
import type { EvaluationSpec, NormalizedDelivery } from '../../public/types/index.js';

export class Normalizer {
  normalize(
    deliveryRaw: Record<string, unknown>,
    spec: EvaluationSpec
  ): { normalized: NormalizedDelivery['normalized']; hash: string; schemaVersion: string } {
    if (spec.deliverableType === 'memo') {
      const normalized = this.normalizeMemo(deliveryRaw);
      return { normalized, hash: sha256Canonical(normalized), schemaVersion: spec.schemaVersion };
    }
    const normalized = this.normalizeRankedTable(deliveryRaw);
    return { normalized, hash: sha256Canonical(normalized), schemaVersion: spec.schemaVersion };
  }

  private normalizeRankedTable(raw: Record<string, unknown>): Record<string, unknown> {
    const items = Array.isArray((raw as any).items) ? (raw as any).items : [];
    const normalizedItems = items
      .map((item: any, idx: number) => ({
        claimId: typeof item?.claimId === 'string' ? item.claimId : `claim-${idx + 1}`,
        entity: String(item?.entity ?? ''),
        rank: Number(item?.rank ?? idx + 1),
        metrics: item?.metrics && typeof item.metrics === 'object' ? item.metrics : {},
        evidenceRefs: Array.isArray(item?.evidenceRefs) ? item.evidenceRefs.map(String) : [],
      }))
      .sort((a, b) => a.rank - b.rank);

    return { items: normalizedItems };
  }

  private normalizeMemo(raw: Record<string, unknown>): Record<string, unknown> {
    return {
      title: String((raw as any).title ?? ''),
      summary: String((raw as any).summary ?? ''),
      findings: Array.isArray((raw as any).findings)
        ? (raw as any).findings.map((f: any) => String(f))
        : [],
      sources: Array.isArray((raw as any).sources)
        ? (raw as any).sources.map((s: any, idx: number) => ({
            claimId: typeof s?.claimId === 'string' ? s.claimId : `claim-${idx + 1}`,
            reference: String(s?.reference ?? ''),
          }))
        : [],
    };
  }
}
