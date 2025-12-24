-- Check if drizzle migrations table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = '__drizzle_migrations'
);

-- If it exists, show applied migrations
SELECT * FROM __drizzle_migrations ORDER BY created_at;

-- Show current tables
\dt

-- Show wallets table structure (if exists)
\d wallets
