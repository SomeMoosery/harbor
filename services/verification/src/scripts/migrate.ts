import { createLogger } from '@harbor/logger';
import { createConfig, SERVICE_PORTS } from '@harbor/config';
import { runVerificationMigrations } from '../private/store/migrate.js';

const logger = createLogger({ service: 'verification-migrate' });
const config = createConfig('verification', SERVICE_PORTS.verification);

runVerificationMigrations(config.database.url, logger)
  .then(() => {
    logger.info('Migrations completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.fatal({ error }, 'Migrations failed');
    process.exit(1);
  });
