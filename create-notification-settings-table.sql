-- Apply notification settings table directly (preserves existing data)

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "notifyOnSuccess" BOOLEAN NOT NULL DEFAULT false,
    "notifyOnError" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnPartial" BOOLEAN NOT NULL DEFAULT true,
    "emailRecipients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "syncTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notification_settings_organizationId_key" ON "notification_settings"("organizationId");

-- AddForeignKey (only if organizations table exists and constraint doesn't exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') AND
       NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'notification_settings_organizationId_fkey') THEN
        ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_organizationId_fkey" 
        FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Insert default global settings (organizationId = null for global)
INSERT INTO "notification_settings" ("id", "organizationId", "notifyOnSuccess", "notifyOnError", "notifyOnPartial", "emailRecipients", "syncTypes", "createdAt", "updatedAt")
SELECT gen_random_uuid(), NULL, false, true, true, 
       ARRAY['pedro.cardoso@comsoftweb.pt']::TEXT[], 
       ARRAY['ARTICLES', 'WAREHOUSE', 'ORDERS', 'CUSTOMERS', 'CUSTOMER_DISCOUNT_GROUPS', 'CUSTOMER_WAREHOUSES']::TEXT[], 
       NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "notification_settings" WHERE "organizationId" IS NULL);

-- Verify
SELECT * FROM "notification_settings" WHERE "organizationId" IS NULL;
