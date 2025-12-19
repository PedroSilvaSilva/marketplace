import prisma from '@config/database';
import { logger } from '@config/logger';

export interface ErrorLogContext {
  // Identifiers
  organizationId: string;
  providerConfigId: string;
  syncJobId?: string;
  
  // Error source
  operation: string; // e.g., 'ARTICLE_SYNC_CHUNK', 'API_UPLOAD', 'CSV_GENERATION'
  entityType: 'ARTICLE' | 'ARTICLE_WAREHOUSE' | 'CUSTOMER' | 'DISCOUNT_GROUP' | 'ORDER';
  
  // Chunk context (if applicable)
  chunkNumber?: number;
  totalChunks?: number;
  chunkSize?: number;
  
  // Data context
  recordsAffected?: number;
  dataSnapshot?: Record<string, any>; // First/sample record that caused error
  
  // Request/Response context
  requestPayload?: string; // CSV content or JSON payload (truncated if large)
  responseBody?: string;
  responseStatus?: number;
  apiEndpoint?: string;
  
  // Validation errors
  validationErrors?: Array<{
    field: string;
    value: any;
    message: string;
  }>;
}

export interface ErrorLogEntry {
  id: string;
  organizationId: string;
  providerConfigId: string;
  syncJobId?: string | null;
  operation: string;
  entityType: string;
  errorMessage: string;
  errorStack?: string | null;
  errorCode?: string | null;
  context: any;
  createdAt: Date;
}

class ErrorLoggerService {
  
  /**
   * Log a detailed error with full context
   */
  async logError(
    error: Error | string,
    context: ErrorLogContext
  ): Promise<ErrorLogEntry> {
    try {
      const errorMessage = typeof error === 'string' ? error : error.message;
      const errorStack = typeof error === 'string' ? undefined : error.stack;
      
      // Extract error code if available (e.g., from API responses)
      let errorCode: string | undefined;
      if (error && typeof error === 'object' && error !== null && 'code' in error) {
        errorCode = String((error as Error & { code?: string }).code);
      } else if (context.responseStatus) {
        errorCode = `HTTP_${context.responseStatus}`;
      }

      // Truncate large payloads
      const truncatedContext = this.truncateLargeFields(context);
      
      // Serialize context to ensure it's JSON-safe
      const jsonSafeContext = JSON.parse(JSON.stringify(truncatedContext));

      // Save to database
      const errorLog = await prisma.syncErrorLog.create({
        data: {
          organizationId: context.organizationId,
          providerConfigId: context.providerConfigId,
          syncJobId: context.syncJobId,
          operation: context.operation,
          entityType: context.entityType,
          errorMessage: errorMessage.substring(0, 5000), // Limit error message length
          errorStack: errorStack?.substring(0, 10000), // Limit stack trace
          errorCode,
          context: jsonSafeContext
        }
      });

      // Also log to console for immediate visibility
      logger.info('SYNC ERROR LOGGED TO DATABASE', {
        errorLogId: errorLog.id,
        operation: context.operation,
        entityType: context.entityType,
        chunkNumber: context.chunkNumber
      });

      return errorLog;
    } catch (dbError) {
      // If database insert fails, log to console with full details
      const errorDetails = dbError instanceof Error ? {
        message: dbError.message,
        stack: dbError.stack,
        name: dbError.name,
        cause: (dbError as Error & { cause?: unknown }).cause
      } : { raw: String(dbError) };
      
      logger.error('Failed to save error log to database - DETAILED ERROR', {
        dbError: errorDetails,
        originalError: error instanceof Error ? error.message : String(error),
        contextKeys: Object.keys(context),
        contextSizes: {
          requestPayload: context.requestPayload?.length || 0,
          responseBody: context.responseBody?.length || 0,
          validationErrors: context.validationErrors?.length || 0
        },
        operation: context.operation,
        entityType: context.entityType,
        chunkNumber: context.chunkNumber
      });
      
      // Try to save a minimal version without large fields
      try {
        const minimalContext = {
          operation: context.operation,
          entityType: context.entityType,
          chunkNumber: context.chunkNumber,
          totalChunks: context.totalChunks,
          recordsAffected: context.recordsAffected,
          errorNote: 'Full context failed to save - see logs'
        };
        
        const minimalLog = await prisma.syncErrorLog.create({
          data: {
            organizationId: context.organizationId,
            providerConfigId: context.providerConfigId,
            syncJobId: context.syncJobId,
            operation: context.operation,
            entityType: context.entityType,
            errorMessage: (error instanceof Error ? error.message : String(error)).substring(0, 5000),
            errorStack: error instanceof Error ? error.stack?.substring(0, 10000) : undefined,
            errorCode: 'LOGGING_ERROR',
            context: minimalContext
          }
        });
        
        logger.info('Saved minimal error log', { errorLogId: minimalLog.id });
        return minimalLog;
      } catch (minimalError) {
        logger.error('Even minimal error log failed', { 
          minimalError: minimalError instanceof Error ? minimalError.message : String(minimalError)
        });
        throw dbError;
      }
    }
  }

  /**
   * Log multiple errors at once (e.g., validation errors for a batch)
   */
  async logBatchErrors(
    errors: Array<{ error: Error | string; context: ErrorLogContext }>
  ): Promise<ErrorLogEntry[]> {
    const errorLogs = await Promise.all(
      errors.map(({ error, context }) => this.logError(error, context))
    );

    logger.warn(`Logged ${errorLogs.length} batch errors`);

    return errorLogs;
  }

  /**
   * Get errors for a specific sync job
   */
  async getErrorsForJob(syncJobId: string): Promise<ErrorLogEntry[]> {
    return prisma.syncErrorLog.findMany({
      where: { syncJobId },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Get recent errors for an organization
   */
  async getRecentErrors(
    organizationId: string,
    options?: {
      entityType?: string;
      operation?: string;
      limit?: number;
    }
  ): Promise<ErrorLogEntry[]> {
    return prisma.syncErrorLog.findMany({
      where: {
        organizationId,
        ...(options?.entityType && { entityType: options.entityType }),
        ...(options?.operation && { operation: options.operation })
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50
    });
  }

  /**
   * Get error statistics for a sync job
   */
  async getJobErrorStats(syncJobId: string): Promise<{
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByChunk: Record<number, number>;
    mostCommonError: string | null;
  }> {
    const errors = await this.getErrorsForJob(syncJobId);

    const errorsByType: Record<string, number> = {};
    const errorsByChunk: Record<number, number> = {};
    const errorMessageCounts: Record<string, number> = {};

    errors.forEach(error => {
      // Count by entity type
      errorsByType[error.entityType] = (errorsByType[error.entityType] || 0) + 1;

      // Count by chunk number
      const context = error.context as Record<string, unknown>;
      if (context?.chunkNumber !== undefined) {
        errorsByChunk[context.chunkNumber as number] = (errorsByChunk[context.chunkNumber as number] || 0) + 1;
      }

      // Count error messages
      errorMessageCounts[error.errorMessage] = (errorMessageCounts[error.errorMessage] || 0) + 1;
    });

    // Find most common error
    const mostCommonError = Object.entries(errorMessageCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    return {
      totalErrors: errors.length,
      errorsByType,
      errorsByChunk,
      mostCommonError
    };
  }

  /**
   * Clean up old error logs (retention policy)
   */
  async cleanupOldErrors(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await prisma.syncErrorLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    logger.info(`Cleaned up ${result.count} old error logs (older than ${daysToKeep} days)`);

    return result.count;
  }

  /**
   * Truncate large fields to prevent database bloat
   */
  private truncateLargeFields(context: ErrorLogContext): ErrorLogContext {
    const MAX_PAYLOAD_SIZE = 5000; // 5KB per field
    const MAX_RESPONSE_SIZE = 5000; // 5KB for response
    const MAX_VALIDATION_ERRORS = 10; // Only keep first 10 validation errors
    
    const truncated = { ...context };

    if (truncated.requestPayload && truncated.requestPayload.length > MAX_PAYLOAD_SIZE) {
      truncated.requestPayload = 
        truncated.requestPayload.substring(0, MAX_PAYLOAD_SIZE) + 
        `\n\n... (truncated ${truncated.requestPayload.length - MAX_PAYLOAD_SIZE} bytes)`;
    }

    if (truncated.responseBody && truncated.responseBody.length > MAX_RESPONSE_SIZE) {
      truncated.responseBody = 
        truncated.responseBody.substring(0, MAX_RESPONSE_SIZE) + 
        `\n\n... (truncated ${truncated.responseBody.length - MAX_RESPONSE_SIZE} bytes)`;
    }
    
    // Limit validation errors array
    if (truncated.validationErrors && truncated.validationErrors.length > MAX_VALIDATION_ERRORS) {
      truncated.validationErrors = [
        ...truncated.validationErrors.slice(0, MAX_VALIDATION_ERRORS),
        {
          field: 'truncated',
          value: `...${truncated.validationErrors.length - MAX_VALIDATION_ERRORS} more errors`,
          message: 'Additional errors truncated to save space'
        }
      ];
    }
    
    // Remove dataSnapshot if too large
    if (truncated.dataSnapshot) {
      const snapshotStr = JSON.stringify(truncated.dataSnapshot);
      if (snapshotStr.length > 1000) {
        truncated.dataSnapshot = { truncated: true, originalSize: snapshotStr.length };
      }
    }

    return truncated;
  }

  /**
   * Format error for display in UI
   */
  formatErrorForDisplay(errorLog: ErrorLogEntry): {
    summary: string;
    details: string;
    context: string;
    stackTrace?: string;
  } {
    const context = errorLog.context as Record<string, unknown>;
    
    let summary = `${errorLog.operation} failed`;
    if (context?.chunkNumber) {
      summary += ` (Chunk ${context.chunkNumber}/${context.totalChunks})`;
    }

    let details = `Error: ${errorLog.errorMessage}`;
    if (errorLog.errorCode) {
      details += `\nCode: ${errorLog.errorCode}`;
    }
    if (context?.recordsAffected) {
      details += `\nRecords affected: ${context.recordsAffected}`;
    }

    let contextStr = JSON.stringify(context, null, 2);

    return {
      summary,
      details,
      context: contextStr,
      stackTrace: errorLog.errorStack || undefined
    };
  }
}

export const ErrorLogger = new ErrorLoggerService();
