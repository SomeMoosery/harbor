import type {
  EvaluationSpec,
  EvidenceBundle,
  NormalizedDelivery,
  VerificationDecision,
} from '../../public/types/index.js';

type CheckResult = { pass: boolean; details?: Record<string, unknown> };

interface InspectResult {
  gatesPassed: boolean;
  structureScore: number;
  evidenceScore: number;
  freshnessScore: number;
  score: number;
  decision: VerificationDecision;
  report: Record<string, unknown>;
}

export class Inspector {
  run(
    spec: EvaluationSpec,
    delivery: NormalizedDelivery,
    evidence: EvidenceBundle,
    now: Date
  ): InspectResult {
    const structure = this.checkStructure(spec, delivery);
    const evidenceRes = this.checkEvidence(spec, delivery, evidence);
    const freshness = this.checkFreshness(spec, evidence, now);

    const gatesPassed = structure.pass && evidenceRes.gatePass && spec.status === 'FROZEN';

    const weights = (spec.spec as any)?.scoredChecks?.weights ?? {
      structure: 0.5,
      freshness: 0.25,
      evidence: 0.25,
    };

    const structureScore = structure.pass ? 1 : 0;
    const evidenceScore = evidenceRes.coverage;
    const freshnessScore = freshness.score;

    const score =
      structureScore * weights.structure +
      evidenceScore * weights.evidence +
      freshnessScore * weights.freshness;

    const thresholds = (spec.spec as any)?.decisionPolicy ?? {
      acceptAt: 0.8,
      rejectBelow: 0.5,
    };

    let decision: VerificationDecision = 'escalate';
    if (!gatesPassed || score <= thresholds.rejectBelow) decision = 'reject';
    else if (score >= thresholds.acceptAt) decision = 'accept';

    const report = {
      gates: {
        specFrozen: spec.status === 'FROZEN',
        structureValid: structure.pass,
        evidencePresent: evidenceRes.gatePass,
      },
      scored: {
        structureScore,
        evidenceScore,
        freshnessScore,
        overall: score,
      },
      details: {
        structure: structure.details,
        evidence: evidenceRes.details,
        freshness: freshness.details,
      },
    };

    return { gatesPassed, structureScore, evidenceScore, freshnessScore, score, decision, report };
  }

  private checkStructure(spec: EvaluationSpec, delivery: NormalizedDelivery): CheckResult {
    if (spec.deliverableType === 'memo') {
      const d = delivery.normalized as any;
      const pass =
        typeof d?.title === 'string' &&
        typeof d?.summary === 'string' &&
        Array.isArray(d?.findings) &&
        Array.isArray(d?.sources);
      return { pass, details: { findingsCount: d?.findings?.length ?? 0, sourcesCount: d?.sources?.length ?? 0 } };
    }

    const items = Array.isArray((delivery.normalized as any)?.items)
      ? (delivery.normalized as any).items
      : [];
    const pass = items.length > 0 && items.every((i: any) => !!i.claimId && !!i.entity);
    return { pass, details: { itemCount: items.length } };
  }

  private checkEvidence(
    spec: EvaluationSpec,
    delivery: NormalizedDelivery,
    evidence: EvidenceBundle
  ): { gatePass: boolean; coverage: number; details: Record<string, unknown> } {
    const requireEvidence = (spec.spec as any)?.evidencePolicy?.requireEvidence ?? true;
    const requireClaimIds = (spec.spec as any)?.evidencePolicy?.requireClaimIds ?? true;

    const items = Array.isArray((delivery.normalized as any)?.items)
      ? (delivery.normalized as any).items
      : [];

    const evidenceItems = evidence.items ?? [];
    const evidenceIds = new Set(evidenceItems.map((e) => e.id));

    let covered = 0;
    let totalClaims = 0;

    if (spec.deliverableType === 'memo') {
      const sources = Array.isArray((delivery.normalized as any)?.sources)
        ? (delivery.normalized as any).sources
        : [];
      totalClaims = sources.length;
      covered = sources.filter((s: any) => evidenceIds.has(s.reference)).length;
    } else {
      totalClaims = items.length;
      covered = items.filter((i: any) => Array.isArray(i.evidenceRefs) && i.evidenceRefs.some((r: any) => evidenceIds.has(r))).length;
    }

    const coverage = totalClaims === 0 ? 0 : covered / totalClaims;
    const gatePass = requireEvidence ? evidenceItems.length > 0 : true;

    // If claim IDs are required but missing, gate fails
    if (requireClaimIds) {
      const hasClaimIds =
        spec.deliverableType === 'memo'
          ? (delivery.normalized as any)?.sources?.every((s: any) => !!s.claimId)
          : items.every((i: any) => !!i.claimId);
      if (!hasClaimIds) {
        return { gatePass: false, coverage: 0, details: { reason: 'missing_claim_ids' } };
      }
    }

    return { gatePass, coverage, details: { totalClaims, covered } };
  }

  private checkFreshness(
    spec: EvaluationSpec,
    evidence: EvidenceBundle,
    now: Date
  ): { score: number; details: Record<string, unknown> } {
    const recencyDays = (spec.spec as any)?.evidencePolicy?.recencyDays;
    if (!recencyDays) return { score: 1, details: { enforced: false } };

    const maxAgeMs = recencyDays * 24 * 60 * 60 * 1000;
    const items = evidence.items ?? [];
    if (items.length === 0) return { score: 0, details: { enforced: true, total: 0, fresh: 0 } };

    let fresh = 0;
    for (const item of items) {
      if (!item.observedAt) continue;
      const age = now.getTime() - new Date(item.observedAt).getTime();
      if (age <= maxAgeMs) fresh += 1;
    }

    const score = fresh / items.length;
    return { score, details: { enforced: true, total: items.length, fresh } };
  }
}
