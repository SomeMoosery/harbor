import type { Sql } from 'postgres';
import type { Logger } from '@harbor/logger';
import type { Environment } from '@harbor/config';
import { sha256Canonical } from '../utils/hash.js';
import { AskSnapshotResource } from '../resources/askSnapshot.resource.js';
import { EvaluationSpecResource } from '../resources/evaluationSpec.resource.js';
import { SpecAcceptanceResource } from '../resources/specAcceptance.resource.js';
import { NormalizedDeliveryResource } from '../resources/normalizedDelivery.resource.js';
import { EvidenceBundleResource } from '../resources/evidenceBundle.resource.js';
import { VerificationJobResource } from '../resources/verificationJob.resource.js';
import { VerificationReportResource } from '../resources/verificationReport.resource.js';
import { Translator } from '../services/translator.js';
import { Normalizer } from '../services/normalizer.js';
import { Inspector } from '../services/inspector.js';
import type {
  AskSnapshot,
  EvaluationSpec,
  EvaluationSpecId,
  EvaluationSpecStatus,
  EvidenceBundle,
  EvidenceBundleId,
  EvidenceItem,
  EvidenceItemType,
  NormalizedDelivery,
  NormalizedDeliveryId,
  VerificationJob,
  VerificationReport,
} from '../../public/types/index.js';

interface CreateAskSnapshotInput {
  ownerType: string;
  ownerId: string;
  askText: string;
  derivedConstraints?: Record<string, unknown>;
  buyerContext?: Record<string, unknown>;
  attachments?: unknown[];
}

interface CreateEvaluationSpecInput {
  askSnapshotId: AskSnapshot['id'];
  deliverableType?: 'ranked_table' | 'memo';
  spec?: Record<string, unknown>;
  schemaVersion?: string;
  status?: EvaluationSpecStatus;
  translatorModelId: string;
  translatorPromptHash: string;
}

interface UpdateEvaluationSpecInput {
  spec?: Record<string, unknown>;
  schemaVersion?: string;
  status?: EvaluationSpecStatus;
  translatorModelId?: string;
  translatorPromptHash?: string;
}

interface CreateNormalizedDeliveryInput {
  specId: EvaluationSpecId;
  deliveryRaw: Record<string, unknown>;
  normalized?: Record<string, unknown>;
  schemaVersion?: string;
}

interface CreateEvidenceBundleInput {
  specId: EvaluationSpecId;
  deliveryId: NormalizedDeliveryId;
  items?: Array<{
    type: EvidenceItemType;
    uri: string;
    contentHash?: string;
    observedAt?: string | null;
    metadata?: Record<string, unknown>;
  }>;
}

interface CreateVerificationJobInput {
  specId: EvaluationSpecId;
  deliveryId: NormalizedDeliveryId;
  evidenceBundleId: EvidenceBundleId;
}

export class VerificationManager {
  private readonly askSnapshots: AskSnapshotResource;
  private readonly specs: EvaluationSpecResource;
  private readonly acceptances: SpecAcceptanceResource;
  private readonly deliveries: NormalizedDeliveryResource;
  private readonly evidenceBundles: EvidenceBundleResource;
  private readonly jobs: VerificationJobResource;
  private readonly reports: VerificationReportResource;
  private readonly translator: Translator;
  private readonly normalizer: Normalizer;
  private readonly inspector: Inspector;

  constructor(env: Environment, db: Sql, private readonly logger: Logger) {
    this.env = env;
    this.askSnapshots = new AskSnapshotResource(db);
    this.specs = new EvaluationSpecResource(db);
    this.acceptances = new SpecAcceptanceResource(db);
    this.deliveries = new NormalizedDeliveryResource(db);
    this.evidenceBundles = new EvidenceBundleResource(db);
    this.jobs = new VerificationJobResource(db);
    this.reports = new VerificationReportResource(db);
    this.translator = new Translator();
    this.normalizer = new Normalizer();
    this.inspector = new Inspector();
    this.logger.debug({ env: this.env }, 'VerificationManager initialized');
  }

  private readonly env: Environment;

  async createAskSnapshot(input: CreateAskSnapshotInput): Promise<AskSnapshot> {
    const payload: Omit<AskSnapshot, 'id' | 'createdAt'> = {
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      askText: input.askText,
      derivedConstraints: input.derivedConstraints ?? {},
      buyerContext: input.buyerContext ?? {},
      attachments: input.attachments ?? [],
      hash: sha256Canonical({
        askText: input.askText,
        derivedConstraints: input.derivedConstraints ?? {},
        buyerContext: input.buyerContext ?? {},
        attachments: input.attachments ?? [],
      }),
    };
    return this.askSnapshots.create(payload);
  }

  async createEvaluationSpec(input: CreateEvaluationSpecInput): Promise<EvaluationSpec> {
    let specBody: Record<string, unknown>;
    let deliverableType: 'ranked_table' | 'memo';
    let schemaVersion = input.schemaVersion ?? '1.0';
    let status: EvaluationSpecStatus = input.status ?? 'DRAFT';

    if (input.spec) {
      specBody = { ...input.spec, deliverableType: input.deliverableType ?? (input.spec as any).deliverableType ?? 'ranked_table' };
      deliverableType = (specBody as any).deliverableType ?? 'ranked_table';
    } else {
      const snapshot = await this.askSnapshots.findById(input.askSnapshotId);
      const compiled = this.translator.compileFromSnapshot(snapshot, {
        deliverableType: input.deliverableType,
        schemaVersion,
      });
      specBody = compiled.spec;
      deliverableType = compiled.deliverableType;
      schemaVersion = compiled.schemaVersion;
      status = compiled.status;
    }

    const hash = sha256Canonical({
      spec: specBody,
      schemaVersion,
    });

    return this.specs.create({
      askSnapshotId: input.askSnapshotId,
      status,
      deliverableType,
      spec: specBody,
      schemaVersion,
      hash,
      translatorModelId: input.translatorModelId,
      translatorPromptHash: input.translatorPromptHash,
    } as EvaluationSpec);
  }

  async updateEvaluationSpec(id: EvaluationSpecId, updates: UpdateEvaluationSpecInput): Promise<EvaluationSpec> {
    const current = await this.specs.findById(id);
    const spec = updates.spec ?? current.spec;
    const hash = sha256Canonical({
      spec,
      schemaVersion: updates.schemaVersion ?? current.schemaVersion,
    });

    return this.specs.update(id, {
      ...updates,
      spec,
      hash,
    });
  }

  async acceptEvaluationSpec(id: EvaluationSpecId, actorType: 'buyer' | 'seller', actorId: string): Promise<{ specId: string; acceptedBy: string; status: EvaluationSpecStatus }> {
    await this.acceptances.add(id, actorType, actorId);

    const buyerAccepted = await this.acceptances.hasActor(id, 'buyer');
    const sellerAccepted = await this.acceptances.hasActor(id, 'seller');
    const status: EvaluationSpecStatus = buyerAccepted && sellerAccepted ? 'FROZEN' : 'DRAFT';

    await this.specs.setStatus(id, status);

    return { specId: id, acceptedBy: actorId, status };
  }

  async createNormalizedDelivery(input: CreateNormalizedDeliveryInput): Promise<NormalizedDelivery> {
    const spec = await this.specs.findById(input.specId);
    const normalizedResult = input.normalized
      ? { normalized: input.normalized, hash: sha256Canonical(input.normalized), schemaVersion: input.schemaVersion ?? '1.0' }
      : this.normalizer.normalize(input.deliveryRaw, spec);

    return this.deliveries.create({
      specId: input.specId,
      deliveryRaw: input.deliveryRaw,
      normalized: normalizedResult.normalized,
      schemaVersion: normalizedResult.schemaVersion,
      hash: normalizedResult.hash,
    });
  }

  async createEvidenceBundle(input: CreateEvidenceBundleInput): Promise<EvidenceBundle> {
    const bundle = await this.evidenceBundles.create({
      specId: input.specId,
      deliveryId: input.deliveryId,
    });

    if (input.items?.length) {
      for (const item of input.items) {
        await this.evidenceBundles.createItem({
          bundleId: bundle.id,
          type: item.type,
          uri: item.uri,
          contentHash: item.contentHash ?? sha256Canonical({ uri: item.uri }),
          observedAt: item.observedAt ?? null,
          metadata: item.metadata ?? {},
        });
      }
    }

    return this.evidenceBundles.findBundle(bundle.id);
  }

  async uploadEvidenceItem(form: Record<string, unknown>): Promise<EvidenceItem> {
    // Expecting fields from multipart parser: bundleId, type, uri, observedAt, contentHash, metadata
    const bundleId = String(form['bundleId'] ?? '');
    const type = (form['type'] ?? 'file') as EvidenceItemType;
    const uri = String(form['uri'] ?? '');
    const observedAt = form['observedAt'] ? String(form['observedAt']) : null;
    const contentHash = String(form['contentHash'] ?? sha256Canonical({ uri }));
    const metadata = (form['metadata'] as Record<string, unknown>) ?? {};

    return this.evidenceBundles.createItem({
      bundleId: bundleId as EvidenceBundleId,
      type,
      uri,
      contentHash,
      observedAt,
      metadata,
    });
  }

  async createVerificationJob(input: CreateVerificationJobInput): Promise<VerificationJob> {
    const job = await this.jobs.create({
      specId: input.specId,
      deliveryId: input.deliveryId,
      evidenceBundleId: input.evidenceBundleId,
      status: 'QUEUED',
    } as VerificationJob);

    // Fire-and-forget processing
    setImmediate(() => {
      this.processJob(job.id).catch((error) => {
        this.logger.error({ error, jobId: job.id }, 'Verification job failed');
      });
    });

    return job;
  }

  async getVerificationJob(id: string): Promise<VerificationJob> {
    return this.jobs.findById(id as any);
  }

  async getVerificationReport(id: string): Promise<VerificationReport> {
    return this.reports.findById(id as any);
  }

  private async processJob(jobId: VerificationJob['id']): Promise<void> {
    const job = await this.jobs.findById(jobId);
    await this.jobs.updateStatus(jobId, 'RUNNING');

    try {
      const spec = await this.specs.findById(job.specId);
      const delivery = await this.deliveries.findById(job.deliveryId);
      const evidence = await this.evidenceBundles.findBundle(job.evidenceBundleId);

      const result = this.inspector.run(spec, delivery, evidence, new Date());

      const report = await this.reports.create({
        jobId,
        specId: spec.id,
        decision: result.decision,
        score: result.score,
        gatesPassed: result.gatesPassed,
        report: result.report,
        hash: sha256Canonical(result.report),
      } as VerificationReport);

      await this.jobs.updateStatus(jobId, 'SUCCEEDED');
      this.logger.info({ jobId, decision: result.decision, score: result.score }, 'Verification job completed');

      return;
    } catch (error) {
      await this.jobs.updateStatus(jobId, 'FAILED', { message: (error as Error).message });
      throw error;
    }
  }
}
