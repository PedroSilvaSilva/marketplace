import sql from 'mssql';
import prisma from '@config/database';
import { CryptoService } from '@utils/crypto';
import { AppError } from '@utils/errors';

/**
 * SQL Service - Manages dynamic SQL Server connections per organization
 */
export class SQLService {
  private static pools: Map<string, sql.ConnectionPool> = new Map();

  /**
   * Get or create connection pool for an organization
   */
  static async getPool(organizationId: string): Promise<sql.ConnectionPool> {
    // Check if pool already exists
    if (this.pools.has(organizationId)) {
      const pool = this.pools.get(organizationId)!;
      if (pool.connected) {
        return pool;
      }
    }

    // Get config from database
    const config = await prisma.dataSourceConfig.findUnique({
      where: { organizationId }
    });

    if (!config) {
      throw new AppError('Data source config not found for this organization', 404);
    }

    if (!config.isActive) {
      throw new AppError('Data source config is inactive', 400);
    }

    // Decrypt password
    const password = config.sqlPassword ? CryptoService.decrypt(config.sqlPassword) : undefined;

    // Build connection config
    const sqlConfig: sql.config = {
      server: config.sqlHost || '',
      database: config.sqlDatabase || '',
      user: config.sqlUser || '',
      password: password,
      options: {
        encrypt: false, // Set to true for Azure
        trustServerCertificate: true,
        enableArithAbort: true,
        instanceName: config.sqlInstance || undefined
      },
      pool: {
        max: config.poolMax || 10,
        min: config.poolMin || 0,
        idleTimeoutMillis: 30000
      },
      connectionTimeout: config.connectionTimeout || 30000, // Increased from 15000
      requestTimeout: config.requestTimeout || 60000 // Increased from 30000 for heavy queries
    };

    // Create and connect pool
    const pool = new sql.ConnectionPool(sqlConfig);
    await pool.connect();

    // Store pool
    this.pools.set(organizationId, pool);

    return pool;
  }

  /**
   * Execute query
   */
  static async query<T = any>(organizationId: string, queryString: string): Promise<T[]> {
    const pool = await this.getPool(organizationId);
    const result = await pool.request().query(queryString);
    return result.recordset as T[];
  }

  /**
   * Execute stored procedure
   */
  static async execute<T = any>(
    organizationId: string, 
    procedureName: string, 
    params?: Record<string, any>
  ): Promise<T[]> {
    const pool = await this.getPool(organizationId);
    const request = pool.request();

    // Add parameters
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        request.input(key, value);
      }
    }

    const result = await request.execute(procedureName);
    return result.recordset as T[];
  }

  /**
   * Test connection
   */
  static async testConnection(organizationId: string): Promise<{ success: boolean; message: string; version?: string }> {
    try {
      const pool = await this.getPool(organizationId);
      const result = await pool.request().query('SELECT @@VERSION AS version');
      
      return {
        success: true,
        message: 'Connection successful',
        version: result.recordset[0]?.version
      };
    } catch (error: any) {
      // Remove failed pool
      if (this.pools.has(organizationId)) {
        const pool = this.pools.get(organizationId)!;
        await pool.close().catch(() => {});
        this.pools.delete(organizationId);
      }

      throw new AppError(`SQL connection failed: ${error.message}`, 500);
    }
  }

  /**
   * Close pool for organization
   */
  static async closePool(organizationId: string): Promise<void> {
    if (this.pools.has(organizationId)) {
      const pool = this.pools.get(organizationId)!;
      await pool.close();
      this.pools.delete(organizationId);
    }
  }

  /**
   * Close all pools (for graceful shutdown)
   */
  static async closeAll(): Promise<void> {
    const closePromises = Array.from(this.pools.values()).map(pool => pool.close());
    await Promise.all(closePromises);
    this.pools.clear();
  }

  /**
   * Get articles from Samiparts (specific for TypsForYou integration)
   */
  static async getArticles(
    organizationId: string,
    options?: {
      page?: number;
      limit?: number;
      search?: string;
      brandId?: string;
      lastProcessedId?: string; // Checkpoint: último ID processado (fase 1)
      modifiedSince?: Date; // Incremental: artigos modificados após data (fase 2)
      excludedBrandIds?: number[]; // BrandIDs to exclude from results
    }
  ) {
    const config = await prisma.dataSourceConfig.findUnique({
      where: { organizationId },
      select: { productView: true }
    });

    if (!config?.productView) {
      throw new AppError('Product view not configured', 400);
    }

    const limit = options?.limit || 1000; // Default 1000 para batch processing
    const page = options?.page || 1;
    const offset = options?.lastProcessedId ? 0 : (page - 1) * limit; // Usa checkpoint ou pagination

    // Build query with ROW_NUMBER() para eliminar duplicados (mantém registo mais recente)
    let query = `
      SELECT 
        BrandId,
        ArticleDiscountGroupCode,
        PartNumber,
        DiscountSubGroupCode,
        InternalPartNumber,
        CategoryCode,
        AttributeID,
        Active,
        Availability,
        Service,
        Sort,
        Picture,
        ArticleName,
        ArticleDescription,
        DaysAsNew,
        Tag,
        ReservedForFutureUse,
        DataCriacao,
        DataAlteracao,
        CompositeId
      FROM (
        SELECT 
          BrandId,
          LTRIM(RTRIM(ArticleDiscountGroupCode)) as ArticleDiscountGroupCode,
          LTRIM(RTRIM(PartNumber)) as PartNumber,
          LTRIM(RTRIM(DiscountSubGroupCode)) as DiscountSubGroupCode,
          LTRIM(RTRIM(InternalPartNumber)) as InternalPartNumber,
          LTRIM(RTRIM(CategoryCode)) as CategoryCode,
          LTRIM(RTRIM(ISNULL(AttributeID, ''))) as AttributeID,
          Active,
          Availability,
          Service,
          ISNULL(Sort, 0) as Sort,
          LTRIM(RTRIM(ISNULL(Picture, ''))) as Picture,
          LTRIM(RTRIM(ArticleName)) as ArticleName,
          LTRIM(RTRIM(ArticleDescription)) as ArticleDescription,
          ISNULL(DaysAsNew, 0) as DaysAsNew,
          LTRIM(RTRIM(ISNULL(Tag, ''))) as Tag,
          LTRIM(RTRIM(ISNULL(ReservedForFutureUse, ''))) as ReservedForFutureUse,
          DataCriacao,
          DataAlteracao,
          CONCAT(CAST(BrandId AS VARCHAR), '-', PartNumber) as CompositeId,
          ROW_NUMBER() OVER (
            PARTITION BY BrandId, PartNumber 
            ORDER BY ISNULL(DataAlteracao, DataCriacao) DESC, DataCriacao DESC
          ) as RowNum
        FROM ${config.productView}
    `;

    // Build WHERE conditions
    const conditions: string[] = [];
    
    // CRITICAL: Exclude records with missing mandatory fields
    conditions.push(`
      BrandId IS NOT NULL AND BrandId <> 0
      AND PartNumber IS NOT NULL AND LTRIM(RTRIM(PartNumber)) <> ''
      AND DiscountSubGroupCode IS NOT NULL AND LTRIM(RTRIM(DiscountSubGroupCode)) <> ''
      AND InternalPartNumber IS NOT NULL AND LTRIM(RTRIM(InternalPartNumber)) <> ''
      AND CategoryCode IS NOT NULL AND LTRIM(RTRIM(CategoryCode)) <> ''
      AND ArticleName IS NOT NULL AND LTRIM(RTRIM(ArticleName)) <> ''
      AND ArticleDescription IS NOT NULL AND LTRIM(RTRIM(ArticleDescription)) <> ''
      AND ArticleDiscountGroupCode IS NOT NULL AND LTRIM(RTRIM(ArticleDiscountGroupCode)) <> ''
    `);
    
    // FILTER: Exclude BrandIDs that TypsForYou API rejects (67, 7000, 7820)
    // Plus any dynamically excluded BrandIDs from API errors
    const excludedBrands = [67, 7000, 7820, ...(options?.excludedBrandIds || [])];
    conditions.push(`BrandId NOT IN (${excludedBrands.join(', ')})`);
    
    // Fase 1: Checkpoint - começar após o último ID processado
    if (options?.lastProcessedId) {
      conditions.push(`CONCAT(CAST(BrandId AS VARCHAR), '-', PartNumber) > '${options.lastProcessedId}'`);
    }
    
    // Fase 2: Incremental - artigos modificados após última sincronização
    if (options?.modifiedSince) {
      const dateStr = options.modifiedSince.toISOString().replace('T', ' ').substring(0, 19);
      conditions.push(`DataAlteracao > '${dateStr}'`);
    }
    
    if (options?.brandId) {
      conditions.push(`BrandId = ${options.brandId}`);
    }
    
    if (options?.search) {
      conditions.push(`(
        PartNumber LIKE '%${options.search}%' 
        OR InternalPartNumber LIKE '%${options.search}%'
        OR ArticleName LIKE '%${options.search}%'
      )`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    // Fechar subquery e filtrar apenas registos únicos (RowNum = 1)
    query += `
      ) AS UniqueArticles
      WHERE RowNum = 1
      ORDER BY CompositeId
      OFFSET ${options?.lastProcessedId ? 0 : offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    // Get total count (com eliminação de duplicados)
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM (
        SELECT BrandId, PartNumber,
               ROW_NUMBER() OVER (PARTITION BY BrandId, PartNumber ORDER BY ISNULL(DataAlteracao, DataCriacao) DESC) as RowNum
        FROM ${config.productView}
    `;
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }
    countQuery += `
      ) AS CountQuery
      WHERE RowNum = 1
    `;

    const [data, countResult] = await Promise.all([
      this.query(organizationId, query),
      this.query<{ total: number }>(organizationId, countQuery)
    ]);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);
    
    // Obter último ID processado neste batch
    const lastId = data.length > 0 ? data[data.length - 1].CompositeId : null;

    return {
      data,
      lastProcessedId: lastId,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get article warehouse (stock/prices)
   */
  static async getArticleWarehouse(
    organizationId: string,
    options?: {
      page?: number;
      limit?: number;
      search?: string;
      brandId?: string;
      warehouseCode?: string;
      providerConfigId?: string;
    }
  ) {
    const config = await prisma.dataSourceConfig.findUnique({
      where: { organizationId },
      select: { stockView: true }
    });

    if (!config?.stockView) {
      throw new AppError('Stock view not configured', 400);
    }

    const page = options?.page || 1;
    const limit = options?.limit || 1000;
    const offset = (page - 1) * limit;

    // Build query with cleaned fields
    let query = `
      SELECT 
        w.BrandId,
        LTRIM(RTRIM(w.PartNumber)) as PartNumber,
        LTRIM(RTRIM(w.WareHouseCode)) as WareHouseCode,
        ISNULL(w.ArticleQuantity, 0) as ArticleQuantity,
        ISNULL(w.ArticlePrice1, 0) as ArticlePrice1,
        ISNULL(w.ArticlePrice2, 0) as ArticlePrice2,
        ISNULL(w.ArticlePrice3, 0) as ArticlePrice3,
        ISNULL(w.ArticlePrice4, 0) as ArticlePrice4,
        ISNULL(w.ArticlePrice5, 0) as ArticlePrice5,
        ISNULL(w.ArticleEcoTax, 0) as ArticleEcoTax,
        LTRIM(RTRIM(ISNULL(w.ArticleCurrency, 'EUR'))) as ArticleCurrency,
        LTRIM(RTRIM(ISNULL(w.Tag, ''))) as Tag,
        LTRIM(RTRIM(ISNULL(w.ReservedForFutureUse, ''))) as ReservedForFutureUse
      FROM ${config.stockView} w
    `;

    // Build WHERE conditions
    const conditions: string[] = [];
    
    // CRITICAL: Exclude warehouse records with missing mandatory fields
    conditions.push(`
      w.BrandId IS NOT NULL AND w.BrandId <> 0
      AND w.PartNumber IS NOT NULL AND LTRIM(RTRIM(w.PartNumber)) <> ''
      AND w.WareHouseCode IS NOT NULL AND LTRIM(RTRIM(w.WareHouseCode)) <> ''
    `);
    
    if (options?.brandId) {
      conditions.push(`w.BrandId = ${options.brandId}`);
    }

    if (options?.warehouseCode) {
      conditions.push(`w.WareHouseCode = '${options.warehouseCode}'`);
    }
    
    if (options?.search) {
      conditions.push(`(
        w.PartNumber LIKE '%${options.search}%'
      )`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add pagination
    query += `
      ORDER BY w.BrandId, w.PartNumber, w.WareHouseCode
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    // Get total count with same EXISTS filter
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM ${config.stockView} w
    `;
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const [data, countResult] = await Promise.all([
      this.query(organizationId, query),
      this.query<{ total: number }>(organizationId, countQuery)
    ]);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get customers
   */
  /**
   * Get customer discount groups with pagination
   */
  static async getCustomerDiscountGroups(
    organizationId: string,
    options?: {
      page?: number;
      limit?: number;
      search?: string;
      lastSyncDate?: Date;
    }
  ) {
    const config = await prisma.dataSourceConfig.findUnique({
      where: { organizationId }
    });

    if (!config) {
      throw new AppError('Data source config not found', 404);
    }

    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const offset = (page - 1) * limit;

    // Build query with pagination - assuming view name similar to article discount groups
    let query = `
      SELECT 
        LTRIM(RTRIM(CustomerDiscountGroupCode)) as CustomerDiscountGroupCode,
        LTRIM(RTRIM(DiscountGroupName)) as DiscountGroupName,
        LTRIM(RTRIM(ISNULL(Tag, ''))) as Tag,
        LTRIM(RTRIM(ISNULL(ReservedForFutureUse, ''))) as ReservedForFutureUse
      FROM u_csw_tips4y_CustomerDiscountGroup
    `;

    const conditions: string[] = [];

    if (options?.search) {
      conditions.push(`(CustomerDiscountGroupCode LIKE '%${options.search}%' OR DiscountGroupName LIKE '%${options.search}%')`);
    }

    // Incremental sync: only get records created or modified since last sync
    if (options?.lastSyncDate) {
      const dateStr = options.lastSyncDate.toISOString().replace('T', ' ').split('.')[0];
      conditions.push(`(DataCriacao >= '${dateStr}' OR DataAlteracao >= '${dateStr}')`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add pagination
    query += `
      ORDER BY CustomerDiscountGroupCode
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM u_csw_tips4y_CustomerDiscountGroup`;
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const [data, countResult] = await Promise.all([
      this.query(organizationId, query),
      this.query<{ total: number }>(organizationId, countQuery)
    ]);

    const total = countResult[0]?.total || 0;

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  static async getCustomers(
    organizationId: string, 
    customerId?: string,
    lastSyncDate?: Date
  ) {
    const config = await prisma.dataSourceConfig.findUnique({
      where: { organizationId }
    });

    if (!config?.customerView) {
      throw new AppError('Customer view not configured', 400);
    }

    // Use SELECT * to get all available columns
    let query = `SELECT * FROM ${config.customerView}`;
    
    const conditions: string[] = [];
    
    if (customerId) {
      conditions.push(`CustomerID = '${customerId}'`);
    }
    
    // Incremental sync: only get customers created or modified since last sync
    if (lastSyncDate) {
      const dateStr = lastSyncDate.toISOString().replace('T', ' ').split('.')[0];
      conditions.push(`(DataCriacao >= '${dateStr}' OR DataAlteracao >= '${dateStr}')`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    // Order by date to track progress
    query += ` ORDER BY COALESCE(DataAlteracao, DataCriacao, GETDATE())`;

    return this.query(organizationId, query);
  }

  /**
   * Get customer warehouses with pagination
   */
  static async getCustomerWarehouses(
    organizationId: string,
    options?: {
      page?: number;
      limit?: number;
      customerId?: string;
      lastSyncDate?: Date;
    }
  ) {
    const config = await prisma.dataSourceConfig.findUnique({
      where: { organizationId }
    });

    if (!config) {
      throw new AppError('Data source config not found', 404);
    }

    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const offset = (page - 1) * limit;

    // Build query with cleaned fields
    let query = `
      SELECT 
        LTRIM(RTRIM(CustomerID)) as CustomerID,
        LTRIM(RTRIM(WarehouseCode)) as WarehouseCode,
        ISNULL(AssignedPrice, 0) as AssignedPrice,
        LTRIM(RTRIM(ISNULL(Tag, ''))) as Tag,
        LTRIM(RTRIM(ISNULL(ReservedForFutureUse, ''))) as ReservedForFutureUse
      FROM u_csw_tips4y_CustomersWarehouses
    `;

    const conditions: string[] = [];

    if (options?.customerId) {
      conditions.push(`CustomerID = '${options.customerId}'`);
    }

    // Incremental sync: only get records created or modified since last sync
    if (options?.lastSyncDate) {
      const dateStr = options.lastSyncDate.toISOString().replace('T', ' ').split('.')[0];
      conditions.push(`(DataCriacao >= '${dateStr}' OR DataAlteracao >= '${dateStr}')`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add pagination
    query += `
      ORDER BY CustomerID, WarehouseCode
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM u_csw_tips4y_CustomersWarehouses`;
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const [data, countResult] = await Promise.all([
      this.query(organizationId, query),
      this.query<{ total: number }>(organizationId, countQuery)
    ]);

    const total = countResult[0]?.total || 0;

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get article discount groups with pagination
   */
  static async getArticleDiscountGroups(
    organizationId: string, 
    options?: {
      page?: number;
      limit?: number;
      search?: string;
      changedSince?: Date; // Filter by DataCriacao or DataAlteracao
    }
  ) {
    const config = await prisma.dataSourceConfig.findUnique({
      where: { organizationId }
    });

    if (!config?.discountGroupView) {
      throw new AppError('Discount group view not configured', 400);
    }

    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const offset = (page - 1) * limit;

    // Build query with pagination
    let query = `
      SELECT 
        ArticleDiscountGroupCode,
        DiscountGroupName,
        Tag,
        ReservedForFutureUse,
        DataCriacao,
        DataAlteracao
      FROM ${config.discountGroupView}
    `;

    // Build WHERE conditions
    const conditions: string[] = [];

    // Filter by changedSince (incremental sync)
    if (options?.changedSince) {
      const dateStr = options.changedSince.toISOString().slice(0, 19).replace('T', ' ');
      conditions.push(`(DataCriacao > '${dateStr}' OR DataAlteracao > '${dateStr}')`);
    }

    // Add search filter if provided
    if (options?.search) {
      conditions.push(`(ArticleDiscountGroupCode LIKE '%${options.search}%' OR DiscountGroupName LIKE '%${options.search}%')`);
    }

    // Add WHERE clause if conditions exist
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add pagination
    query += `
      ORDER BY ArticleDiscountGroupCode
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM ${config.discountGroupView}`;
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const [data, countResult] = await Promise.all([
      this.query(organizationId, query),
      this.query<{ total: number }>(organizationId, countQuery)
    ]);

    const total = countResult[0]?.total || 0;

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get article discount sub-groups with pagination
   */
  static async getArticleDiscountSubGroups(
    organizationId: string, 
    options?: {
      page?: number;
      limit?: number;
      search?: string;
      groupCode?: string;
      changedSince?: Date; // Filter by DataCriacao or DataAlteracao
    }
  ) {
    const config = await prisma.dataSourceConfig.findUnique({
      where: { organizationId }
    });

    if (!config?.discountSubGroupView) {
      throw new AppError('Discount sub-group view not configured', 400);
    }

    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const offset = (page - 1) * limit;

    // Build query with pagination
    let query = `
      SELECT 
        LTRIM(RTRIM(ArticleDiscountGroupCode)) as ArticleDiscountGroupCode,
        LTRIM(RTRIM(DiscountSubGroupCode)) as DiscountSubGroupCode,
        LTRIM(RTRIM(DiscountSubGroupName)) as DiscountSubGroupName,
        LTRIM(RTRIM(ISNULL(Tag, ''))) as Tag,
        DataCriacao,
        DataAlteracao
      FROM ${config.discountSubGroupView}
    `;

    // Build WHERE conditions
    const conditions: string[] = [];
    
    // CRITICAL: Exclude records with empty DiscountSubGroupCode (required by TypsForYou)
    conditions.push(`DiscountSubGroupCode IS NOT NULL AND LTRIM(RTRIM(DiscountSubGroupCode)) <> ''`);
    
    // Filter by changedSince (incremental sync)
    if (options?.changedSince) {
      const dateStr = options.changedSince.toISOString().slice(0, 19).replace('T', ' ');
      conditions.push(`(DataCriacao > '${dateStr}' OR DataAlteracao > '${dateStr}')`);
    }
    
    if (options?.groupCode) {
      conditions.push(`ArticleDiscountGroupCode = '${options.groupCode}'`);
    }
    
    if (options?.search) {
      conditions.push(`(
        DiscountSubGroupCode LIKE '%${options.search}%' 
        OR DiscountSubGroupName LIKE '%${options.search}%'
      )`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Add pagination
    query += `
      ORDER BY ArticleDiscountGroupCode, DiscountSubGroupCode
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM ${config.discountSubGroupView}`;
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const [data, countResult] = await Promise.all([
      this.query(organizationId, query),
      this.query<{ total: number }>(organizationId, countQuery)
    ]);

    const total = countResult[0]?.total || 0;

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }
}
