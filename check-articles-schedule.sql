-- Check ARTICLES sync configuration and timing
SELECT 
    sc.id,
    sc."syncType",
    sc.enabled,
    sc."intervalSeconds",
    sc."lastSyncAt",
    sc."lastSuccessAt",
    sc."lastErrorAt",
    sc."lastError",
    -- Calculate when next sync should occur
    sc."lastSyncAt" + (sc."intervalSeconds" || ' seconds')::INTERVAL as "nextSyncDue",
    -- Time until next sync
    (sc."lastSyncAt" + (sc."intervalSeconds" || ' seconds')::INTERVAL) - NOW() as "timeUntilNextSync",
    -- Time since last sync
    NOW() - sc."lastSyncAt" as "timeSinceLastSync",
    sc.options
FROM sync_configurations sc
WHERE sc."syncType" = 'ARTICLES'
AND sc."organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';

-- Check if ArticleSchedulerService is being used (look for recent execution logs)
SELECT 
    COUNT(*) as total_executions,
    MAX("startedAt") as last_execution,
    NOW() - MAX("startedAt") as time_since_last_execution
FROM sync_execution_logs
WHERE "syncType" = 'ARTICLES'
AND "organizationId" = 'b41e3222-7b2b-4a63-967d-c1eebe05612a';
