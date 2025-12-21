import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import type { Logger } from '@harbor/logger';
import type { Environment } from '@harbor/config';
import { getDb } from '../store/index.js';
import { WalletResource } from '../resources/wallet.resource.js';
import { TransactionResource } from '../resources/transaction.resource.js';
import { LedgerEntryResource } from '../resources/ledgerEntry.resource.js';
import { WalletManager } from '../managers/wallet.manager.js';
import { WalletController } from '../controllers/wallet.controller.js';
import { CircleWalletProvider } from '../providers/circleWalletProvider.js';
import { StripePaymentProvider } from '../providers/stripePaymentProvider.js';
import { MockWalletProvider } from '../providers/mockWalletProvider.js';
import { MockPaymentProvider } from '../providers/mockPaymentProvider.js';
import { createWalletSchema, depositSchema, transferSchema } from '../validators/wallet.validator.js';

export function createRoutes(env: Environment, connectionString: string, useLocalPostgres: boolean, logger: Logger, config: any) {
  const app = new Hono();

  // Enable CORS for local development
  app.use('/*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }));

  const db = getDb(env, connectionString, useLocalPostgres, logger);

  // Initialize resources
  const walletResource = new WalletResource(db, logger);
  const transactionResource = new TransactionResource(db, logger);
  const ledgerEntryResource = new LedgerEntryResource(db, logger);

  // Initialize providers
  // Use mock providers or real providers based on config
  const walletProvider = config.providers.useReal
    ? new CircleWalletProvider(logger, {
        apiKey: config.circle.apiKey,
        entitySecret: config.circle.entitySecret,
        isTestnet: env !== 'production',
      })
    : new MockWalletProvider(logger);

  const paymentProvider = config.providers.useReal
    ? new StripePaymentProvider(logger, {
        apiKey: config.stripe.apiKey,
        webhookSecret: config.stripe.webhookSecret,
        isTest: env !== 'production',
      })
    : new MockPaymentProvider(logger);

  // Initialize manager and controller
  const manager = new WalletManager(
    walletResource,
    transactionResource,
    ledgerEntryResource,
    walletProvider,
    paymentProvider,
    logger
  );
  const controller = new WalletController(manager, logger);

  // Health check
  app.get('/health', (c) => controller.health(c));

  // Wallet routes
  app.post('/wallets', zValidator('json', createWalletSchema), async (c) => {
    return controller.createWallet(c);
  });

  // More specific routes must come before generic :id routes
  app.get('/wallets/agent/:agentId', (c) => controller.getWalletByAgentId(c));
  app.get('/wallets/agent/:agentId/balance', (c) => controller.getBalanceByAgentId(c));

  app.get('/wallets/:id', (c) => controller.getWallet(c));
  app.get('/wallets/:id/balance', (c) => controller.getBalance(c));
  app.get('/wallets/:id/transactions', (c) => controller.getTransactions(c));

  // Transaction routes
  app.post('/deposit', zValidator('json', depositSchema), async (c) => {
    return controller.deposit(c);
  });

  app.post('/transfer', zValidator('json', transferSchema), async (c) => {
    return controller.transfer(c);
  });

  // Stripe Checkout for funding agents
  app.post('/funding/checkout', async (c) => {
    return controller.createFundingCheckout(c);
  });

  // Stripe webhook handler
  app.post('/webhooks/stripe', async (c) => {
    return controller.handleStripeWebhook(c, paymentProvider);
  });

  return app;
}
