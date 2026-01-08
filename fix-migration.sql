-- Fix migration issue
DELETE FROM _prisma_migrations WHERE migration_name = '20251208174609_add_synced_articles';

-- Verify
SELECT migration_name, finished_at, rolled_back_at 
FROM _prisma_migrations 
ORDER BY finished_at DESC 
LIMIT 10;
