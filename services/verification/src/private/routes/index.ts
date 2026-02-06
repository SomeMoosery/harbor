import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Logger } from '@harbor/logger';
import type { Environment } from '@harbor/config';
import { getDb } from '../store/index.js';
import { VerificationController } from '../controllers/verification.controller.js';
import { createAskSnapshotSchema } from '../validators/askSnapshot.validator.js';
import { createEvaluationSpecSchema, updateEvaluationSpecSchema } from '../validators/evaluationSpec.validator.js';
import { createEvidenceItemSchema } from '../validators/evidenceItem.validator.js';
import { createEvidenceBundleSchema } from '../validators/evidenceBundle.validator.js';
import { createNormalizedDeliverySchema } from '../validators/normalizedDelivery.validator.js';
import { createVerificationJobSchema } from '../validators/verificationJob.validator.js';

export function createRoutes(env: Environment, connectionString: string, _useLocalPostgres: boolean, logger: Logger) {
  const app = new Hono();
  const db = getDb(connectionString, logger);
  const controller = new VerificationController(env, db, logger);

  app.get('/health', (c: Context) => c.json({ status: 'ok', env }));

  app.post('/ask-snapshots', zValidator('json', createAskSnapshotSchema), (c: Context) => controller.createAskSnapshot(c));
  app.post('/evaluation-specs', zValidator('json', createEvaluationSpecSchema), (c: Context) => controller.createEvaluationSpec(c));
  app.patch('/evaluation-specs/:id', zValidator('json', updateEvaluationSpecSchema), (c: Context) => controller.updateEvaluationSpec(c));
  app.post('/evaluation-specs/:id/accept', (c: Context) => controller.acceptEvaluationSpec(c));

  app.post('/evidence-items', zValidator('form', createEvidenceItemSchema), (c: Context) => controller.uploadEvidenceItem(c));
  app.post('/evidence-bundles', zValidator('json', createEvidenceBundleSchema), (c: Context) => controller.createEvidenceBundle(c));
  app.post('/normalized-deliveries', zValidator('json', createNormalizedDeliverySchema), (c: Context) => controller.createNormalizedDelivery(c));
  app.post('/verification-jobs', zValidator('json', createVerificationJobSchema), (c: Context) => controller.createVerificationJob(c));
  app.get('/verification-jobs/:id', (c: Context) => controller.getVerificationJob(c));
  app.get('/verification-reports/:id', (c: Context) => controller.getVerificationReport(c));

  return app;
}
