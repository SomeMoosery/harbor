// Branded ID helpers
type Brand<K, T> = K & { __brand: T };

export type AskSnapshotId = Brand<string, 'AskSnapshotId'>;
export type EvaluationSpecId = Brand<string, 'EvaluationSpecId'>;
export type NormalizedDeliveryId = Brand<string, 'NormalizedDeliveryId'>;
export type EvidenceBundleId = Brand<string, 'EvidenceBundleId'>;
export type EvidenceItemId = Brand<string, 'EvidenceItemId'>;
export type VerificationJobId = Brand<string, 'VerificationJobId'>;
export type VerificationReportId = Brand<string, 'VerificationReportId'>;

export type EvaluationSpecStatus = 'DRAFT' | 'REVIEW_REQUIRED' | 'FROZEN';
export type VerificationJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'REVIEW_REQUIRED';
export type VerificationDecision = 'accept' | 'reject' | 'escalate';
export type EvidenceItemType = 'url_snapshot' | 'file';

export interface AskSnapshot {
  id: AskSnapshotId;
  ownerType: string;
  ownerId: string;
  askText: string;
  derivedConstraints: Record<string, unknown>;
  buyerContext: Record<string, unknown>;
  attachments: unknown[];
  hash: string;
  createdAt: string;
}

export interface EvaluationSpec {
  id: EvaluationSpecId;
  askSnapshotId: AskSnapshotId;
  status: EvaluationSpecStatus;
  /** Deliverable type is also stored inside spec.deliverableType */
  deliverableType?: 'ranked_table' | 'memo';
  spec: Record<string, unknown>;
  schemaVersion: string;
  hash: string;
  translatorModelId: string;
  translatorPromptHash: string;
  createdAt: string;
}

export interface NormalizedDelivery {
  id: NormalizedDeliveryId;
  specId: EvaluationSpecId;
  deliveryRaw: Record<string, unknown>;
  normalized: Record<string, unknown>;
  schemaVersion: string;
  hash: string;
  createdAt: string;
}

export interface EvidenceItem {
  id: EvidenceItemId;
  bundleId: EvidenceBundleId;
  type: EvidenceItemType;
  uri: string;
  contentHash: string;
  observedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface EvidenceBundle {
  id: EvidenceBundleId;
  specId: EvaluationSpecId;
  deliveryId: NormalizedDeliveryId;
  createdAt: string;
  items?: EvidenceItem[];
}

export interface VerificationJob {
  id: VerificationJobId;
  specId: EvaluationSpecId;
  deliveryId: NormalizedDeliveryId;
  evidenceBundleId: EvidenceBundleId;
  status: VerificationJobStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationReport {
  id: VerificationReportId;
  jobId: VerificationJobId;
  specId: EvaluationSpecId;
  decision: VerificationDecision;
  score: number;
  gatesPassed: boolean;
  report: Record<string, unknown>;
  hash: string;
  createdAt: string;
}
