import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import type { Logger } from '@harbor/logger';
import type { Environment, Config } from '@harbor/config';
import { getDb } from '../store/index.js';
import { EscrowLockResource } from '../resources/escrowLock.resource.js';
import { SettlementResource } from '../resources/settlement.resource.js';
import { SettlementManager } from '../managers/settlement.manager.js';
import { SettlementController } from '../controllers/settlement.controller.js';
import { lockEscrowSchema, releaseEscrowSchema } from '../validators/settlement.validator.js';

export function createRoutes(env: Environment, connectionString: string, logger: Logger, config: Config) {
  const app = new Hono();
  const db = getDb(env, connectionString, logger);

  // Initialize resources
  const escrowLockResource = new EscrowLockResource(db, logger);
  const settlementResource = new SettlementResource(db, logger);

  // Initialize manager and controller
  const manager = new SettlementManager(
    escrowLockResource,
    settlementResource,
    config,
    logger
  );
  const controller = new SettlementController(manager, logger);

  // Health check
  app.get('/health', (c) => controller.health(c));

  // Escrow routes
  app.post('/escrow/lock', zValidator('json', lockEscrowSchema), (c) => controller.lockEscrow(c));
  app.post('/escrow/release', zValidator('json', releaseEscrowSchema), (c) => controller.releaseEscrow(c));
  app.get('/escrow/:id', (c) => controller.getEscrowLock(c));
  app.get('/escrow/bid/:bidId', (c) => controller.getEscrowLockByBidId(c));

  // Settlement routes
  app.get('/settlements/:id', (c) => controller.getSettlement(c));

  return app;
}
