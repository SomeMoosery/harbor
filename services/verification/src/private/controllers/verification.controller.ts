import type { Context } from 'hono';
import type { Logger } from '@harbor/logger';
import type { Sql } from 'postgres';
import type { Environment } from '@harbor/config';
import { VerificationManager } from '../managers/verification.manager.js';
import { handleError } from '../utils/errorHandler.js';
import type { EvaluationSpecId } from '../../public/types/index.js';

export class VerificationController {
  constructor(
    env: Environment,
    db: Sql,
    private readonly logger: Logger
  ) {
    this.manager = new VerificationManager(env, db, logger);
  }

  private readonly manager: VerificationManager;

  async createAskSnapshot(c: Context) {
    try {
      const body = c.req.valid('json');
      const result = await this.manager.createAskSnapshot(body);
      return c.json(result, 201);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async createEvaluationSpec(c: Context) {
    try {
      const body = c.req.valid('json');
      const result = await this.manager.createEvaluationSpec(body);
      return c.json(result, 201);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async updateEvaluationSpec(c: Context) {
    try {
      const id = c.req.param('id');
      const body = c.req.valid('json');
      const result = await this.manager.updateEvaluationSpec(id, body);
      return c.json(result);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async acceptEvaluationSpec(c: Context) {
    try {
      const id = c.req.param('id');
      const actorId = c.req.header('X-User-Id') ?? 'anonymous';
      const actorTypeHeader = c.req.header('X-Actor-Type') ?? 'buyer';
      const actorType = actorTypeHeader === 'seller' ? 'seller' : 'buyer';
      const result = await this.manager.acceptEvaluationSpec(id as EvaluationSpecId, actorType, actorId);
      return c.json(result);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async uploadEvidenceItem(c: Context) {
    try {
      const form = await c.req.parseBody();
      const result = await this.manager.uploadEvidenceItem(form);
      return c.json(result, 201);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async createEvidenceBundle(c: Context) {
    try {
      const body = c.req.valid('json');
      const result = await this.manager.createEvidenceBundle(body);
      return c.json(result, 201);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async createNormalizedDelivery(c: Context) {
    try {
      const body = c.req.valid('json');
      const result = await this.manager.createNormalizedDelivery(body);
      return c.json(result, 201);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async createVerificationJob(c: Context) {
    try {
      const body = c.req.valid('json');
      const result = await this.manager.createVerificationJob(body);
      return c.json(result, 202);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async getVerificationJob(c: Context) {
    try {
      const id = c.req.param('id');
      const result = await this.manager.getVerificationJob(id);
      return c.json(result);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }

  async getVerificationReport(c: Context) {
    try {
      const id = c.req.param('id');
      const result = await this.manager.getVerificationReport(id);
      return c.json(result);
    } catch (error) {
      return handleError(c, error, this.logger);
    }
  }
}
