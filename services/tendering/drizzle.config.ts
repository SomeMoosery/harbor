import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/private/store/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_TENDERING ?? process.env.DATABASE_URL ?? '',
  },
});
