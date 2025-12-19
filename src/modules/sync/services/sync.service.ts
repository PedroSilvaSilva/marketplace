import { SQLService } from '../../../services/sql.service';
import { Typs4YouClient } from '../clients/typs4you.client';
import logger from '@config/logger';
import { AppError } from '@utils/errors';
import prisma from '@config/database';

/**
 * Sync Service - Orchestrates data sync between SQL Server and TypsForYou
 */
export class SyncService {
  /**
   * Generate CSV from staged articles (SyncArticle table)
   */
  static async generateCsvFromStaging(
    organizationId: string,
    providerConfigId: string,
    options?: {
      status?: string; // Filter by status (PENDING, VALIDATED, etc)
      limit?: number;
    }
  ): Promise<{
    success: boolean;
    csv: string;
    articlesCount: number;
  }> {
    try {
      logger.info('Generating CSV from staging...', {
        organizationId,
        providerConfigId,
        status: options?.status,
        limit: options?.limit
      });

      // Fetch articles from staging table
      const articles = await prisma.syncArticle.findMany({
        where: {
          organizationId,
          providerConfigId,
          ...(options?.status && { status: options.status as any })
        },
        take: options?.limit,
        orderBy: { createdAt: 'asc' }
      });

      logger.info(`Found ${articles.length} articles in staging`);

      if (articles.length === 0) {
        return {
          success: true,
          csv: '',
          articlesCount: 0
        };
      }

      // Convert to CSV
      const csvLines: string[] = [];

      articles.forEach(article => {
        const row = [
          '2', // TESTE: Forçar BrandID = 2 (HELLA) para todos os artigos
          'FAM2', // TESTE: Forçar DiscountGroupCode = FAM1 para todos os artigos
          article.partNumber,
          article.discountSubGroupCode,
          article.internalPartNumber,
          article.categoryCode,
          article.attributeId || '',
          article.active ? '1' : '0',
          article.availability ? '1' : '0',
          article.service ? '1' : '0',
          article.sort.toString(),
          article.picture || '',
          article.articleName,
          article.articleDescription,
          article.daysAsNew.toString(),
          article.tag || '',
          article.reservedForFutureUse || ''
        ];

        csvLines.push(row.join(';'));
      });

      const csv = csvLines.map(line => line.trimEnd()).join('\n');

      logger.info(`CSV generated successfully with ${csvLines.length} lines`);

      return {
        success: true,
        csv,
        articlesCount: articles.length
      };

    } catch (error: any) {
      logger.error('Generate CSV from staging failed:', error);
      throw new AppError(`CSV generation failed: ${error.message}`, 500);
    }
  }

  /**
   * Convert SQL articles to CSV format for TypsForYou
   */
  static articlesToCsv(articles: any[]): string {
    // NO HEADER - TypsForYou API rejects CSV with header
    const csvLines: string[] = [];

    // Convert each article to CSV row (NO quotes, API rejects them)
    // IMPORTANT: Empty fields MUST have a value (space or 0), NOT empty string
    articles.forEach(article => {
      // Helper function to clean text fields (mandatory fields get space if empty, optional get empty string)
      const cleanTextField = (value: string | number | null | undefined, isMandatory: boolean = false): string => {
        if (value === null || value === undefined || value === '') {
          return isMandatory ? ' ' : '';
        }
        // Remove line breaks and semicolons (CSV separator), keep commas
        const cleaned = value.toString().trim().replace(/[\r\n]/g, ' ').replace(/;/g, ' ');
        return cleaned || (isMandatory ? ' ' : '');
      };

      const row = [
        // 1. BrandId (MANDATORY) - must have value
        article.BrandId !== undefined && article.BrandId !== null && article.BrandId !== '' && article.BrandId !== 0 
          ? article.BrandId.toString() : '0',
        // 2. ArticleDiscountGroupCode (MANDATORY)
        cleanTextField(article.ArticleDiscountGroupCode || article.DiscountGroupCode, true),
        // 3. PartNumber (MANDATORY)
        cleanTextField(article.PartNumber, true),
        // 4. DiscountSubGroupCode (MANDATORY)
        cleanTextField(article.DiscountSubGroupCode, true),
        // 5. InternalPartNumber (MANDATORY)
        cleanTextField(article.InternalPartNumber, true),
        // 6. CategoryCode (MANDATORY)
        cleanTextField(article.CategoryCode, true),
        // 7. AttributeID (OPTIONAL - empty if not set)
        (article.AttributeID && article.AttributeID !== 0 && article.AttributeID !== '') 
          ? article.AttributeID.toString() : '',
        // 8. Active (MANDATORY - 0 or 1)
        (article.Active === 1 || article.Active === true) ? '1' : '0',
        // 9. Availability (MANDATORY - 0 or 1)
        (article.Availability === 1 || article.Availability === true) ? '1' : '0',
        // 10. Service (OPTIONAL - 0 or 1, can be empty)
        (article.Service === 1 || article.Service === true) ? '1' : '0',
        // 11. Sort (OPTIONAL - empty if not set)
        (article.Sort && article.Sort !== 0 && article.Sort !== '') ? article.Sort.toString() : '',
        // 12. Picture (OPTIONAL - empty if not set)
        cleanTextField(article.Picture, false),
        // 13. ArticleName (MANDATORY)
        cleanTextField(article.ArticleName, true),
        // 14. ArticleDescription (MANDATORY)
        cleanTextField(article.ArticleDescription, true),
        // 15. DaysAsNew (OPTIONAL - but use 0 as default for numeric field)
        (article.DaysAsNew && article.DaysAsNew !== 0 && article.DaysAsNew !== '') ? article.DaysAsNew.toString() : '0',
        // 16. Tag (OPTIONAL - empty if not set)
        cleanTextField(article.Tag, false),
        // 17. ReservedForFutureUse (OPTIONAL - empty if not set)
        cleanTextField(article.ReservedForFutureUse, false)
      ];

      // Join all 17 columns with SEMICOLONS (;) - not commas!
      csvLines.push(row.join(';'));
    });

    // Use Unix line endings (LF) - join and ensure no trailing whitespace on each line
    return csvLines.map(line => line.trimEnd()).join('\n');
  }

  /**
   * Import articles from SQL Server to staging table (sync_articles)
   */
  static async importArticlesToStaging(
    organizationId: string,
    providerConfigId: string,
    options?: {
      limit?: number;
      replaceExisting?: boolean; // Se true, limpa artigos existentes antes de importar
    }
  ): Promise<{
    success: boolean;
    articlesRead: number;
    articlesImported: number;
    articlesSkipped: number;
    errors: string[];
  }> {
    try {
      logger.info('Starting import articles to staging...', {
        organizationId,
        providerConfigId,
        limit: options?.limit,
        replaceExisting: options?.replaceExisting
      });

      // Step 1: Clear existing articles if requested
      if (options?.replaceExisting) {
        await prisma.syncArticle.deleteMany({
          where: {
            organizationId,
            providerConfigId
          }
        });
        logger.info('Cleared existing sync articles');
      }

      // Step 2: Read articles from SQL Server
      const articles = await SQLService.getArticles(organizationId, options?.limit);
      logger.info(`Read ${articles.length} articles from SQL Server`);

      // Step 3: Validate and import articles
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const article of articles) {
        try {
          // Validate mandatory fields
          const hasBrandId = article.BrandId && article.BrandId !== 0 && article.BrandId !== '';
          const hasDiscountGroupCode = (article.ArticleDiscountGroupCode || article.DiscountGroupCode || '').trim() !== '';
          const hasPartNumber = (article.PartNumber || '').trim() !== '';
          const hasDiscountSubGroupCode = (article.DiscountSubGroupCode || '').trim() !== '';
          const hasInternalPartNumber = (article.InternalPartNumber || '').trim() !== '';
          const hasCategoryCode = (article.CategoryCode || '').trim() !== '';
          const hasArticleName = (article.ArticleName || '').trim() !== '';
          const hasArticleDescription = (article.ArticleDescription || '').trim() !== '';

          if (!hasBrandId || !hasDiscountGroupCode || !hasPartNumber || 
              !hasDiscountSubGroupCode || !hasInternalPartNumber || 
              !hasCategoryCode || !hasArticleName || !hasArticleDescription) {
            skipped++;
            continue;
          }

          // Create sync article
          await prisma.syncArticle.create({
            data: {
              organizationId,
              providerConfigId,
              sourceArticleId: article.ArticleId?.toString(),
              brandId: article.BrandId.toString(),
              articleDiscountGroupCode: (article.ArticleDiscountGroupCode || article.DiscountGroupCode || '').trim(),
              partNumber: (article.PartNumber || '').trim(),
              discountSubGroupCode: (article.DiscountSubGroupCode || '').trim(),
              internalPartNumber: (article.InternalPartNumber || '').trim(),
              categoryCode: (article.CategoryCode || '').trim(),
              attributeId: article.AttributeID?.toString() || null,
              active: article.Active === 1 || article.Active === true,
              availability: article.Availability === 1 || article.Availability === true,
              service: article.Service === 1 || article.Service === true,
              sort: article.Sort || 0,
              picture: article.Picture || null,
              articleName: (article.ArticleName || '').trim(),
              articleDescription: (article.ArticleDescription || '').trim(),
              daysAsNew: article.DaysAsNew || 0,
              tag: article.Tag || null,
              reservedForFutureUse: article.ReservedForFutureUse || null,
              status: 'PENDING'
            }
          });
          
          imported++;
        } catch (error: any) {
          skipped++;
          errors.push(`Error importing article ${article.PartNumber}: ${error.message}`);
        }
      }

      logger.info(`Import completed: ${imported} imported, ${skipped} skipped`);

      return {
        success: true,
        articlesRead: articles.length,
        articlesImported: imported,
        articlesSkipped: skipped,
        errors: errors.slice(0, 10) // Return first 10 errors
      };

    } catch (error: any) {
      logger.error('Import articles to staging failed:', error);
      throw new AppError(`Import failed: ${error.message}`, 500);
    }
  }

  /**
   * Send staged articles to TypsForYou and update status based on API response
   */
  static async sendStagedArticles(
    organizationId: string,
    providerConfigId: string,
    options?: {
      status?: string;
      limit?: number;
    }
  ): Promise<{
    success: boolean;
    articlesCount: number;
    sent: number;
    rejected: number;
    errors: any[];
    uploadResult: any;
  }> {
    try {
      logger.info('Sending staged articles to TypsForYou...', {
        organizationId,
        providerConfigId,
        status: options?.status,
        limit: options?.limit
      });

      // Generate CSV
      const csvResult = await this.generateCsvFromStaging(
        organizationId,
        providerConfigId,
        options
      );

      if (csvResult.articlesCount === 0) {
        return {
          success: true,
          articlesCount: 0,
          sent: 0,
          rejected: 0,
          errors: [],
          uploadResult: null
        };
      }

      // Send to TypsForYou
      const client = new Typs4YouClient(providerConfigId);
      let uploadResult;
      let hasErrors = false;

      try {
        uploadResult = await client.uploadArticlesCsv(csvResult.csv);
        
        // Mark all as sent if no errors
        if (uploadResult.ExitCode === '200' && !uploadResult.DataErrorsFound) {
          await prisma.syncArticle.updateMany({
            where: {
              organizationId,
              providerConfigId,
              ...(options?.status && { status: options.status as any })
            },
            data: {
              status: 'SENT',
              sentAt: new Date(),
              attempts: { increment: 1 },
              lastAttemptAt: new Date()
            }
          });

          return {
            success: true,
            articlesCount: csvResult.articlesCount,
            sent: csvResult.articlesCount,
            rejected: 0,
            errors: [],
            uploadResult
          };
        }

        hasErrors = true;

      } catch (error: any) {
        hasErrors = true;
        // Extract error details from AppError message
        const errorMessage = error.message || '';
        
        // Try to parse DataErrorsFound from error message
        const errorsMatch = errorMessage.match(/First errors: (\[.*?\])/);
        if (errorsMatch) {
          try {
            const parsedErrors = JSON.parse(errorsMatch[1]);
            uploadResult = {
              error: errorMessage,
              DataErrorsFound: parsedErrors,
              ExitCode: 'ERROR'
            };
          } catch (parseError) {
            uploadResult = { error: errorMessage };
          }
        } else {
          uploadResult = { error: errorMessage };
        }
      }

      // Process errors if any
      const errors = uploadResult?.DataErrorsFound || [];
      let rejected = 0;

      if (errors.length > 0) {
        // Parse errors and update article status
        for (const error of errors) {
          const errorMsg = error.Error_Message || '';
          
          // Extract codes from error messages
          // Example: "Campo ou Parametro DiscountGroupCode Errado ou Inexistente.1606.5"
          const codeMatch = errorMsg.match(/Inexistente\.(.+?)\s/);
          if (codeMatch) {
            const invalidCode = codeMatch[1].trim();
            
            // Find and mark articles with this invalid code
            if (errorMsg.includes('DiscountGroupCode')) {
              await prisma.syncArticle.updateMany({
                where: {
                  organizationId,
                  providerConfigId,
                  articleDiscountGroupCode: invalidCode
                },
                data: {
                  status: 'REJECTED',
                  errorMessage: errorMsg,
                  attempts: { increment: 1 },
                  lastAttemptAt: new Date()
                }
              });
              rejected++;
            } else if (errorMsg.includes('BrandID')) {
              await prisma.syncArticle.updateMany({
                where: {
                  organizationId,
                  providerConfigId,
                  brandId: invalidCode
                },
                data: {
                  status: 'REJECTED',
                  errorMessage: errorMsg,
                  attempts: { increment: 1 },
                  lastAttemptAt: new Date()
                }
              });
              rejected++;
            }
          }
        }

        // Mark remaining articles that were in the batch but not rejected as ERROR (need retry)
        // Only mark as SENT if there were no errors at all
        const statusToSet = rejected > 0 ? 'ERROR' : 'SENT';
        
        await prisma.syncArticle.updateMany({
          where: {
            organizationId,
            providerConfigId,
            status: options?.status || 'PENDING',
            NOT: {
              status: 'REJECTED'
            }
          },
          data: {
            status: statusToSet,
            ...(statusToSet === 'SENT' && { sentAt: new Date() }),
            attempts: { increment: 1 },
            lastAttemptAt: new Date()
          }
        });
      } else {
        // Mark all as ERROR if we caught an exception
        await prisma.syncArticle.updateMany({
          where: {
            organizationId,
            providerConfigId,
            status: options?.status || 'PENDING'
          },
          data: {
            status: 'ERROR',
            errorMessage: uploadResult?.error || 'Unknown error',
            attempts: { increment: 1 },
            lastAttemptAt: new Date()
          }
        });
      }

      const sent = errors.length === 0 ? csvResult.articlesCount : (csvResult.articlesCount - rejected);

      logger.info(`Send completed: ${sent} sent, ${rejected} rejected`);

      return {
        success: errors.length === 0,
        articlesCount: csvResult.articlesCount,
        sent,
        rejected,
        errors: errors.slice(0, 10),
        uploadResult
      };

    } catch (error: any) {
      logger.error('Send staged articles failed:', error);
      throw new AppError(`Send failed: ${error.message}`, 500);
    }
  }

  /**
   * Fetch existing articles from TypsForYou and mark them in staging table
   */
  static async syncExistingArticles(
    organizationId: string,
    providerConfigId: string
  ): Promise<{
    success: boolean;
    totalFetched: number;
    markedAsSent: number;
    notFound: number;
  }> {
    try {
      logger.info('Fetching existing articles from TypsForYou...', {
        organizationId,
        providerConfigId
      });

      const client = new Typs4YouClient(providerConfigId);
      
      // Fetch all articles from TypsForYou (without limit)
      const response = await client.getArticles({ limit: 999999 });
      const existingArticles = response.Table || [];

      logger.info(`Fetched ${existingArticles.length} articles from TypsForYou`);

      let markedAsSent = 0;
      let notFound = 0;

      // Mark articles in staging as SENT if they exist in TypsForYou
      for (const article of existingArticles) {
        const result = await prisma.syncArticle.updateMany({
          where: {
            organizationId,
            providerConfigId,
            partNumber: article.PartNumber,
            brandId: article.BrandId.toString()
          },
          data: {
            status: 'SENT',
            sentAt: new Date()
          }
        });

        if (result.count > 0) {
          markedAsSent += result.count;
        } else {
          notFound++;
        }
      }

      logger.info(`Sync completed: ${markedAsSent} marked as sent, ${notFound} not found in staging`);

      return {
        success: true,
        totalFetched: existingArticles.length,
        markedAsSent,
        notFound
      };

    } catch (error: any) {
      logger.error('Sync existing articles failed:', error);
      throw new AppError(`Sync failed: ${error.message}`, 500);
    }
  }

  /**
   * Sync articles from SQL Server to TypsForYou (OLD METHOD - deprecated)
   */
  static async syncArticles(
    organizationId: string,
    providerConfigId: string,
    options?: {
      limit?: number;
      dryRun?: boolean; // If true, only generate CSV without uploading
    }
  ): Promise<{
    success: boolean;
    articlesRead: number;
    csvGenerated: boolean;
    uploaded: boolean;
    csv?: string;
    result?: any;
  }> {
    try {
      logger.info('Starting articles sync...', {
        organizationId,
        providerConfigId,
        limit: options?.limit,
        dryRun: options?.dryRun
      });

      // Step 1: Read articles from SQL Server
      const articles = await SQLService.getArticles(organizationId, options?.limit);
      
      logger.info(`Read ${articles.length} articles from SQL Server`);

      // Step 2: Validate and filter articles - only include those with ALL mandatory fields
      const validArticles = articles.filter(article => {
        // Mandatory fields according to TypsForYou API documentation
        const hasBrandId = article.BrandId && article.BrandId !== 0 && article.BrandId !== '';
        const hasDiscountGroupCode = (article.ArticleDiscountGroupCode || article.DiscountGroupCode || '').trim() !== '';
        const hasPartNumber = (article.PartNumber || '').trim() !== '';
        const hasDiscountSubGroupCode = (article.DiscountSubGroupCode || '').trim() !== '';
        const hasInternalPartNumber = (article.InternalPartNumber || '').trim() !== '';
        const hasCategoryCode = (article.CategoryCode || '').trim() !== '';
        const hasArticleName = (article.ArticleName || '').trim() !== '';
        const hasArticleDescription = (article.ArticleDescription || '').trim() !== '';
        
        // All mandatory fields must be present
        return hasBrandId && hasDiscountGroupCode && hasPartNumber && 
               hasDiscountSubGroupCode && hasInternalPartNumber && 
               hasCategoryCode && hasArticleName && hasArticleDescription;
      });

      logger.info(`Filtered to ${validArticles.length} valid articles (all mandatory fields present)`, {
        filtered: articles.length - validArticles.length,
        total: articles.length
      });

      if (validArticles.length === 0) {
        return {
          success: true,
          articlesRead: articles.length,
          csvGenerated: false,
          uploaded: false
        };
      }

      // Step 2: Convert to CSV
      const csv = this.articlesToCsv(validArticles);
      
      logger.info('CSV generated successfully', {
        size: csv.length,
        lines: csv.split('\n').length
      });

      // Save CSV to file for inspection
      const fs = require('fs');
      const path = require('path');
      const csvFilePath = path.join(process.cwd(), `articles_${Date.now()}.csv`);
      fs.writeFileSync(csvFilePath, csv, 'utf8');
      logger.info(`CSV saved to: ${csvFilePath}`);

      // If dry run, return CSV without uploading
      if (options?.dryRun) {
        return {
          success: true,
          articlesRead: articles.length,
          csvGenerated: true,
          csvFilePath,
          uploaded: false,
          csv
        };
      }

      // Step 3: Upload to TypsForYou
      const client = new Typs4YouClient(providerConfigId);
      const result = await client.uploadArticlesCsv(csv);

      logger.info('Articles sync completed successfully', {
        articlesRead: articles.length,
        exitCode: result?.ExitCode
      });

      return {
        success: true,
        articlesRead: validArticles.length,
        csvGenerated: true,
        uploaded: true,
        result
      };

    } catch (error: any) {
      logger.error('Articles sync failed:', error.message);
      throw new AppError(`Sync failed: ${error.message}`, 500);
    }
  }
}
