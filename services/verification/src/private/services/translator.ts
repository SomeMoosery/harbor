import type { AskSnapshot, EvaluationSpec, EvaluationSpecStatus } from '../../public/types/index.js';
import { sha256Canonical } from '../utils/hash.js';

const DEFAULT_WEIGHTS = {
  structure: 0.5,
  freshness: 0.25,
  evidence: 0.25,
};

const DEFAULT_THRESHOLDS = {
  acceptAt: 0.8,
  rejectBelow: 0.5,
};

export interface TranslatorOutput {
  spec: Record<string, unknown>;
  hash: string;
  deliverableType: 'ranked_table' | 'memo';
  schemaVersion: string;
  status: EvaluationSpecStatus;
}

export class Translator {
  compileFromSnapshot(
    snapshot: AskSnapshot,
    options: { deliverableType?: 'ranked_table' | 'memo'; schemaVersion?: string }
  ): TranslatorOutput {
    const deliverableType = options.deliverableType ?? this.pickDeliverableType(snapshot.askText);
    const schemaVersion = options.schemaVersion ?? '1.0';

    const spec = deliverableType === 'ranked_table' ? this.buildRankedTableSpec() : this.buildMemoSpec();

    const specBody = {
      ...spec,
      deliverableType,
      decisionPolicy: {
        acceptAt: DEFAULT_THRESHOLDS.acceptAt,
        rejectBelow: DEFAULT_THRESHOLDS.rejectBelow,
      },
      scoredChecks: {
        weights: {
          structure: DEFAULT_WEIGHTS.structure,
          freshness: DEFAULT_WEIGHTS.freshness,
          evidence: DEFAULT_WEIGHTS.evidence,
        },
      },
    };

    const hash = sha256Canonical({ spec: specBody, schemaVersion });

    return {
      spec: specBody,
      hash,
      deliverableType,
      schemaVersion,
      status: 'DRAFT',
    };
  }

  private pickDeliverableType(text: string): 'ranked_table' | 'memo' {
    const lower = text.toLowerCase();
    if (lower.includes('rank') || lower.includes('best') || lower.includes('top')) return 'ranked_table';
    return 'memo';
  }

  private buildRankedTableSpec() {
    return {
      structure: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['claimId', 'entity', 'rank'],
              properties: {
                claimId: { type: 'string' },
                entity: { type: 'string' },
                rank: { type: 'number' },
                metrics: { type: 'object', additionalProperties: true },
                evidenceRefs: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
      evidencePolicy: {
        requireEvidence: true,
        requireClaimIds: true,
        // No default recency window; must be provided explicitly in future versions
      },
      dimensions: {
        structure: { gates: ['schema_valid'] },
        evidence: { requiresClaimMapping: true },
        freshness: { recencyDays: null },
      },
    };
  }

  private buildMemoSpec() {
    return {
      structure: {
        type: 'object',
        required: ['title', 'summary', 'findings', 'sources'],
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          findings: { type: 'array', items: { type: 'string' } },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              required: ['claimId', 'reference'],
              properties: {
                claimId: { type: 'string' },
                reference: { type: 'string' },
              },
            },
          },
        },
      },
      evidencePolicy: {
        requireEvidence: true,
        requireClaimIds: true,
      },
      dimensions: {
        structure: { gates: ['schema_valid'] },
        evidence: { requiresClaimMapping: true },
        freshness: { recencyDays: null },
      },
    };
  }
}
