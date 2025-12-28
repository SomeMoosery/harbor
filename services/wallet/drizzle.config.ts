import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/private/store/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL || process.env.DATABASE_URL_WALLET || 'postgresql://localhost:5432/harbor_wallet',
  },
});
