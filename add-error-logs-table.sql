-- ============================================
-- Add Error Notification Logs Table
-- This script ONLY ADDS new tables/enums
-- It does NOT modify or delete existing data
-- ============================================

-- Create ErrorContext enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "ErrorContext" AS ENUM (
        'articles',
        'warehouse',
        'orders',
        'discountGroup',
        'discountSubGroup',
        'customers',
        'customerDiscountGroup',
        'customerWarehouse'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create error_notification_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS "error_notification_logs" (
    "id" TEXT NOT NULL,
    "context" "ErrorContext" NOT NULL,
    "method" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "errorStack" TEXT,
    "internalPartNumber" TEXT,
    "orderNumber" TEXT,
    "articleDiscountGroupCode" TEXT,
    "discountSubGroupCode" TEXT,
    "customerId" TEXT,
    "additionalInfo" JSONB,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "emailRecipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emailError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_notification_logs_pkey" PRIMARY KEY ("id")
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "error_notification_logs_context_idx" ON "error_notification_logs"("context");
CREATE INDEX IF NOT EXISTS "error_notification_logs_method_idx" ON "error_notification_logs"("method");
CREATE INDEX IF NOT EXISTS "error_notification_logs_createdAt_idx" ON "error_notification_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "error_notification_logs_emailSent_idx" ON "error_notification_logs"("emailSent");
CREATE INDEX IF NOT EXISTS "error_notification_logs_internalPartNumber_idx" ON "error_notification_logs"("internalPartNumber");
CREATE INDEX IF NOT EXISTS "error_notification_logs_orderNumber_idx" ON "error_notification_logs"("orderNumber");
CREATE INDEX IF NOT EXISTS "error_notification_logs_customerId_idx" ON "error_notification_logs"("customerId");

-- Verify table was created
SELECT 
    'error_notification_logs table created successfully!' as message,
    COUNT(*) as initial_count
FROM error_notification_logs;
