-- Create cache table to track ArticleWarehouse changes
CREATE TABLE IF NOT EXISTS article_warehouse_sync_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  
  -- Article identification
  brand_id VARCHAR(255) NOT NULL,
  part_number VARCHAR(255) NOT NULL,
  warehouse_code VARCHAR(255) NOT NULL,
  
  -- Data hash for change detection
  data_hash VARCHAR(64) NOT NULL,
  
  -- Tracking
  last_synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Composite unique key
  UNIQUE(organization_id, brand_id, part_number, warehouse_code)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_article_warehouse_cache_org 
  ON article_warehouse_sync_cache(organization_id);

CREATE INDEX IF NOT EXISTS idx_article_warehouse_cache_last_synced 
  ON article_warehouse_sync_cache(last_synced_at);

COMMENT ON TABLE article_warehouse_sync_cache IS 
  'Cache table to detect changes in ArticleWarehouse data for incremental sync';
