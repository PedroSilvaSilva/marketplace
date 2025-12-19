import axios, { AxiosInstance } from 'axios';
import prisma from '@config/database';
import { CryptoService } from '@utils/crypto';
import { AppError } from '@utils/errors';
import logger from '@config/logger';

/**
 * Token cache interface
 */
interface TokenCache {
  token: string;
  expiry: Date;
}

/**
 * TypsForYou API Client
 * Handles authentication and API calls to TypsForYou marketplace
 */
export class Typs4YouClient {
  private axiosInstance: AxiosInstance;
  private providerConfigId: string;
  
  // Static token cache shared across all instances (per providerConfigId)
  private static tokenCache: Map<string, TokenCache> = new Map();

  constructor(providerConfigId: string) {
    this.providerConfigId = providerConfigId;
    
    // Create axios instance with default config
    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('TypsForYou API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url
        });
        throw error;
      }
    );
  }

  /**
   * Authenticate with TypsForYou API
   * Returns an access token valid for 24 hours
   */
  async authenticate(): Promise<string> {
    try {
      // Check static token cache first (shared across instances)
      const cachedToken = Typs4YouClient.tokenCache.get(this.providerConfigId);
      if (cachedToken) {
        const now = new Date();
        const buffer = 5 * 60 * 1000; // 5 minutes
        if (cachedToken.expiry.getTime() - now.getTime() > buffer) {
          logger.info('Using cached TypsForYou token from static cache');
          return cachedToken.token;
        } else {
          logger.info('Cached token expired or expiring soon, refreshing...');
        }
      }

      // Get provider config from database
      const config = await prisma.providerConfig.findUnique({
        where: { id: this.providerConfigId },
        include: {
          organization: {
            select: { name: true }
          }
        }
      });

      if (!config) {
        throw new AppError('Provider config not found', 404);
      }

      if (!config.isActive) {
        throw new AppError('Provider config is inactive', 400);
      }

      // Decrypt credentials
      const apiKey = config.apiKey ? CryptoService.decrypt(config.apiKey) : null;
      const apiSecret = config.apiSecret ? CryptoService.decrypt(config.apiSecret) : null;
      const subscriptionKey = config.webhookSecret ? CryptoService.decrypt(config.webhookSecret) : null;

      if (!apiKey || !apiSecret) {
        throw new AppError('API credentials not configured', 400);
      }

      if (!subscriptionKey) {
        throw new AppError('Subscription key not configured', 400);
      }

      // Prepare auth endpoint (lowercase as per API)
      const authUrl = `${config.apiUrl}/auth`;
      
      logger.info(`Authenticating with TypsForYou API for ${config.organization.name}...`, {
        url: authUrl,
        login: apiKey,
        password: apiSecret.substring(0, 5) + '...',
        subscriptionKey: subscriptionKey
      });

      // Prepare form-data as string
      const formData = `Login=${encodeURIComponent(apiKey)}&Password=${encodeURIComponent(apiSecret)}`;

      logger.info('Sending auth request with headers:', {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Ocp-Apim-Subscription-Key': subscriptionKey
      });

      logger.info('Form data:', formData);

      // Make authentication request
      const response = await this.axiosInstance.post(authUrl, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Ocp-Apim-Subscription-Key': subscriptionKey
        }
      });

      // Extract token from response (TypsForYou returns "Token" with capital T)
      const token = response.data?.Token;
      const exitCode = response.data?.ExitCode;
      
      if (!token || exitCode !== '200') {
        const exitMessage = response.data?.ExitMessage || 'Unknown error';
        throw new AppError(`TypsForYou authentication failed: ${exitMessage}`, 401);
      }

      // Store token in static cache (TypsForYou doesn't provide expiry, assume 24 hours)
      const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      Typs4YouClient.tokenCache.set(this.providerConfigId, {
        token,
        expiry: tokenExpiry
      });

      logger.info('TypsForYou authentication successful - NEW TOKEN OBTAINED', {
        tokenPrefix: token.substring(0, 20),
        tokenLength: token.length,
        expiresAt: tokenExpiry.toISOString(),
        providerConfigId: this.providerConfigId
      });

      // Update last sync timestamp
      await prisma.providerConfig.update({
        where: { id: this.providerConfigId },
        data: { lastSyncAt: new Date() }
      });

      return token;

    } catch (error: any) {
      const message = error.response?.data?.message || error.message;
      logger.error('TypsForYou authentication failed:', message);
      throw new AppError(`TypsForYou authentication failed: ${message}`, 401);
    }
  }

  /**
   * Get authenticated axios instance
   * Automatically handles authentication
   */
  async getAuthenticatedClient(): Promise<AxiosInstance> {
    const token = await this.authenticate();
    
    // Clone instance with auth header
    const authenticatedInstance = axios.create({
      ...this.axiosInstance.defaults,
      headers: {
        ...this.axiosInstance.defaults.headers,
        'Authorization': `Bearer ${token}`
      }
    });

    return authenticatedInstance;
  }

  /**
   * Test authentication
   */
  async testAuth(): Promise<{ success: boolean; token: string; expiresAt: Date }> {
    const token = await this.authenticate();
    const cachedToken = Typs4YouClient.tokenCache.get(this.providerConfigId);
    
    return {
      success: true,
      token: token.substring(0, 20) + '...', // Only show first 20 chars for security
      expiresAt: cachedToken?.expiry || new Date()
    };
  }

  /**
   * Get articles from TypsForYou
   * @param filters Optional filters (page, limit, search, etc)
   */
  async getArticles(filters?: {
    page?: number;
    limit?: number;
    search?: string;
    brandId?: string;
    active?: boolean;
  }): Promise<any> {
    try {
      // Get provider config to build URL
      const config = await prisma.providerConfig.findUnique({
        where: { id: this.providerConfigId }
      });

      if (!config) {
        throw new AppError('Provider config not found', 404);
      }

      // Authenticate
      const token = await this.authenticate();
      
      logger.info('Token obtained for articles request:', {
        tokenPrefix: token.substring(0, 20),
        tokenLength: token.length
      });

      // Build articles endpoint URL (lowercase!)
      const articlesUrl = `${config.apiUrl}/articles`;

      // Build query params
      const params = new URLSearchParams();
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.search) params.append('search', filters.search);
      if (filters?.brandId) params.append('brandId', filters.brandId);
      if (filters?.active !== undefined) params.append('active', filters.active.toString());

      const url = params.toString() ? `${articlesUrl}?${params.toString()}` : articlesUrl;

      // Get subscription key
      const subscriptionKey = config.webhookSecret ? CryptoService.decrypt(config.webhookSecret) : null;

      logger.info('Fetching articles from TypsForYou...', { 
        url,
        hasToken: !!token,
        hasSubscriptionKey: !!subscriptionKey,
        subscriptionKey: subscriptionKey
      });

      // Make request with Token header (not Bearer!)
      const response = await this.axiosInstance.get(url, {
        headers: {
          'Token': token,
          'Ocp-Apim-Subscription-Key': subscriptionKey || '',
          'Accept': 'application/json'
        }
      });

      logger.info('Articles fetched successfully', {
        count: Array.isArray(response.data?.Table) ? response.data.Table.length : 'unknown'
      });

      return response.data;

    } catch (error: any) {
      // TypsForYou returns 400 with "Não foram encontrados registos" when empty
      if (error.response?.status === 400 && 
          error.response?.data?.ExitMesssage?.includes('Não foram encontrados registos')) {
        logger.info('No articles found (empty result)');
        return {
          StartTime: error.response.data.StartTime,
          EndTime: error.response.data.EndTime,
          Duration: error.response.data.Duration,
          Table: [],
          ExitCode: '200',
          ExitMesssage: 'No records found'
        };
      }

      const message = error.response?.data?.ExitMesssage || error.response?.data?.message || error.message;
      logger.error('Failed to fetch articles from TypsForYou:', message);
      throw new AppError(`Failed to fetch articles: ${message}`, error.response?.status || 500);
    }
  }

  /**
   * Get article warehouse (stock) from TypsForYou
   * @param filters Optional filters (page, limit, articleId, etc)
   */
  async getArticleWarehouse(filters?: {
    page?: number;
    limit?: number;
    articleId?: string;
    brandId?: string;
    partNumber?: string;
  }): Promise<any> {
    try {
      // Get provider config to build URL
      const config = await prisma.providerConfig.findUnique({
        where: { id: this.providerConfigId }
      });

      if (!config) {
        throw new AppError('Provider config not found', 404);
      }

      // Authenticate
      const token = await this.authenticate();
      
      logger.info('Token obtained for articlewarehouse request:', {
        tokenPrefix: token.substring(0, 20),
        tokenLength: token.length
      });

      // Build articlewarehouse endpoint URL (lowercase!)
      const warehouseUrl = `${config.apiUrl}/articlewarehouse`;

      // Build query params
      const params = new URLSearchParams();
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.articleId) params.append('articleId', filters.articleId);
      if (filters?.brandId) params.append('brandId', filters.brandId);
      if (filters?.partNumber) params.append('partNumber', filters.partNumber);

      const url = params.toString() ? `${warehouseUrl}?${params.toString()}` : warehouseUrl;

      // Get subscription key
      const subscriptionKey = config.webhookSecret ? CryptoService.decrypt(config.webhookSecret) : null;

      logger.info('Fetching article warehouse from TypsForYou...', { 
        url,
        hasToken: !!token,
        hasSubscriptionKey: !!subscriptionKey
      });

      // Make request with Token header
      const response = await this.axiosInstance.get(url, {
        headers: {
          'Token': token,
          'Ocp-Apim-Subscription-Key': subscriptionKey || '',
          'Accept': 'application/json'
        }
      });

      logger.info('Article warehouse fetched successfully', {
        count: Array.isArray(response.data?.Table) ? response.data.Table.length : 'unknown'
      });

      return response.data;

    } catch (error: any) {
      // TypsForYou returns 400 with "Não foram encontrados registos" when empty
      if (error.response?.status === 400 && 
          error.response?.data?.ExitMesssage?.includes('Não foram encontrados registos')) {
        logger.info('No article warehouse found (empty result)');
        return {
          StartTime: error.response.data.StartTime,
          EndTime: error.response.data.EndTime,
          Duration: error.response.data.Duration,
          Table: [],
          ExitCode: '200',
          ExitMesssage: 'No records found'
        };
      }

      const message = error.response?.data?.ExitMesssage || error.response?.data?.message || error.message;
      logger.error('Failed to fetch article warehouse from TypsForYou:', message);
      throw new AppError(`Failed to fetch article warehouse: ${message}`, error.response?.status || 500);
    }
  }

  /**
   * Get customers warehouses from TypsForYou
   * @param filters Optional filters (page, limit, customerId, etc)
   */
  async getCustomersWarehouses(filters?: {
    page?: number;
    limit?: number;
    customerId?: string;
    warehouseCode?: string;
  }): Promise<any> {
    try {
      // Get provider config to build URL
      const config = await prisma.providerConfig.findUnique({
        where: { id: this.providerConfigId }
      });

      if (!config) {
        throw new AppError('Provider config not found', 404);
      }

      // Authenticate
      const token = await this.authenticate();
      
      logger.info('Token obtained for customerswarehouses request:', {
        tokenPrefix: token.substring(0, 20),
        tokenLength: token.length
      });

      // Build customerswarehouses endpoint URL (lowercase!)
      const customersWarehousesUrl = `${config.apiUrl}/customerswarehouses`;

      // Build query params
      const params = new URLSearchParams();
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.customerId) params.append('customerId', filters.customerId);
      if (filters?.warehouseCode) params.append('warehouseCode', filters.warehouseCode);

      const url = params.toString() ? `${customersWarehousesUrl}?${params.toString()}` : customersWarehousesUrl;

      // Get subscription key
      const subscriptionKey = config.webhookSecret ? CryptoService.decrypt(config.webhookSecret) : null;

      logger.info('Fetching customers warehouses from TypsForYou...', { 
        url,
        hasToken: !!token,
        hasSubscriptionKey: !!subscriptionKey
      });

      // Make request with Token header
      const response = await this.axiosInstance.get(url, {
        headers: {
          'Token': token,
          'Ocp-Apim-Subscription-Key': subscriptionKey || '',
          'Accept': 'application/json'
        }
      });

      logger.info('Customers warehouses fetched successfully', {
        count: Array.isArray(response.data?.Table) ? response.data.Table.length : 'unknown'
      });

      return response.data;

    } catch (error: any) {
      // TypsForYou returns 400 with "Não foram encontrados registos" when empty
      if (error.response?.status === 400 && 
          error.response?.data?.ExitMesssage?.includes('Não foram encontrados registos')) {
        logger.info('No customers warehouses found (empty result)');
        return {
          StartTime: error.response.data.StartTime,
          EndTime: error.response.data.EndTime,
          Duration: error.response.data.Duration,
          Table: [],
          ExitCode: '200',
          ExitMesssage: 'No records found'
        };
      }

      const message = error.response?.data?.ExitMesssage || error.response?.data?.message || error.message;
      logger.error('Failed to fetch customers warehouses from TypsForYou:', message);
      throw new AppError(`Failed to fetch customers warehouses: ${message}`, error.response?.status || 500);
    }
  }

  /**
   * Get customers from TypsForYou
   * @param filters Optional filters (page, limit, customerId, etc)
   */
  async getCustomers(filters?: {
    page?: number;
    limit?: number;
    customerId?: string;
    name?: string;
  }): Promise<any> {
    try {
      // Get provider config to build URL
      const config = await prisma.providerConfig.findUnique({
        where: { id: this.providerConfigId }
      });

      if (!config) {
        throw new AppError('Provider config not found', 404);
      }

      // Authenticate
      const token = await this.authenticate();
      
      logger.info('Token obtained for customers request:', {
        tokenPrefix: token.substring(0, 20),
        tokenLength: token.length
      });

      // Build customers endpoint URL (lowercase!)
      const customersUrl = `${config.apiUrl}/customers`;

      // Build query params
      const params = new URLSearchParams();
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.customerId) params.append('customerId', filters.customerId);
      if (filters?.name) params.append('name', filters.name);

      const url = params.toString() ? `${customersUrl}?${params.toString()}` : customersUrl;

      // Get subscription key
      const subscriptionKey = config.webhookSecret ? CryptoService.decrypt(config.webhookSecret) : null;

      logger.info('Fetching customers from TypsForYou...', { 
        url,
        hasToken: !!token,
        hasSubscriptionKey: !!subscriptionKey
      });

      // Make request with Token header
      const response = await this.axiosInstance.get(url, {
        headers: {
          'Token': token,
          'Ocp-Apim-Subscription-Key': subscriptionKey || '',
          'Accept': 'application/json'
        }
      });

      logger.info('Customers fetched successfully', {
        count: Array.isArray(response.data?.Table) ? response.data.Table.length : 'unknown'
      });

      return response.data;

    } catch (error: any) {
      // TypsForYou returns 400 with "Não foram encontrados registos" when empty
      if (error.response?.status === 400 && 
          error.response?.data?.ExitMesssage?.includes('Não foram encontrados registos')) {
        logger.info('No customers found (empty result)');
        return {
          StartTime: error.response.data.StartTime,
          EndTime: error.response.data.EndTime,
          Duration: error.response.data.Duration,
          Table: [],
          ExitCode: '200',
          ExitMesssage: 'No records found'
        };
      }

      const message = error.response?.data?.ExitMesssage || error.response?.data?.message || error.message;
      logger.error('Failed to fetch customers from TypsForYou:', message);
      throw new AppError(`Failed to fetch customers: ${message}`, error.response?.status || 500);
    }
  }

  /**
   * Upload Article Discount Groups to TypsForYou via CSV
   * @param csvContent CSV file content as string or Buffer
   */
  async uploadDiscountGroupsCsv(csvContent: string | Buffer): Promise<any> {
    try {
      // Get provider config
      const config = await prisma.providerConfig.findUnique({
        where: { id: this.providerConfigId }
      });

      if (!config) {
        throw new AppError('Provider config not found', 404);
      }

      // Authenticate
      const token = await this.authenticate();
      
      logger.info('Uploading discount groups CSV to TypsForYou...');

      // Build endpoint URL
      const url = `${config.apiUrl}/articlediscountgroup`;

      // Get subscription key
      const subscriptionKey = config.webhookSecret ? CryptoService.decrypt(config.webhookSecret) : null;

      // Create FormData
      const FormData = require('form-data');
      const formData = new FormData();
      
      // Convert string to Buffer with Windows line endings and ensure UTF-8
      let csvString = typeof csvContent === 'string' ? csvContent : csvContent.toString('utf8');
      
      // Normalize to UTF-8 (remove BOM if present)
      csvString = csvString.replace(/^\uFEFF/, '');
      
      // Remove any trailing whitespace from each line
      csvString = csvString.split(/\r?\n/).map(line => line.trimEnd()).join('\n');
      
      // Replace LF with CRLF for proper CSV format
      csvString = csvString.replace(/\n/g, '\r\n');
      
      const csvBuffer = Buffer.from(csvString, 'utf8');
      
      // Add CSV file
      formData.append('File', csvBuffer, {
        filename: 'discount_groups.csv',
        contentType: 'text/csv; charset=utf-8'
      });

      // Make POST request with multipart/form-data
      const response = await this.axiosInstance.post(url, formData, {
        headers: {
          'Token': token,
          'Ocp-Apim-Subscription-Key': subscriptionKey || '',
          ...formData.getHeaders()
        }
      });

      logger.info('Discount groups CSV uploaded successfully to TypsForYou', {
        exitCode: response.data?.ExitCode,
        loadedRecords: response.data?.LoadedRecords,
        message: response.data?.ExitMesssage
      });

      return response.data;

    } catch (error: any) {
      const responseData = error.response?.data;
      const message = responseData?.ExitMesssage || responseData?.message || error.message;
      const errors = responseData?.DataErrorsFound;
      
      logger.error('Failed to upload discount groups CSV to TypsForYou:', {
        message,
        errors: errors?.slice(0, 5),
        exitCode: responseData?.ExitCode
      });
      
      const errorDetail = errors && errors.length > 0 
        ? `${message}. Errors: ${JSON.stringify(errors.slice(0, 3))}`
        : message;
      
      throw new AppError(`Failed to upload discount groups CSV: ${errorDetail}`, error.response?.status || 500);
    }
  }

  /**
   * Upload Article Discount Sub-Groups to TypsForYou via CSV
   * @param csvContent CSV file content as string or Buffer
   */
  async uploadDiscountSubGroupsCsv(csvContent: string | Buffer): Promise<any> {
    try {
      // Get provider config
      const config = await prisma.providerConfig.findUnique({
        where: { id: this.providerConfigId }
      });

      if (!config) {
        throw new AppError('Provider config not found', 404);
      }

      // Authenticate
      const token = await this.authenticate();
      
      logger.info('Uploading discount sub-groups CSV to TypsForYou...');

      // Build endpoint URL
      const url = `${config.apiUrl}/articlediscountsubgroup`;

      // Get subscription key
      const subscriptionKey = config.webhookSecret ? CryptoService.decrypt(config.webhookSecret) : null;

      // Create FormData
      const FormData = require('form-data');
      const formData = new FormData();
      
      // Convert string to Buffer with Windows line endings and ensure UTF-8
      let csvString = typeof csvContent === 'string' ? csvContent : csvContent.toString('utf8');
      
      // Normalize to UTF-8 (remove BOM if present)
      csvString = csvString.replace(/^\uFEFF/, '');
      
      // Remove any trailing whitespace from each line
      csvString = csvString.split(/\r?\n/).map(line => line.trimEnd()).join('\n');
      
      // Replace LF with CRLF for proper CSV format
      csvString = csvString.replace(/\n/g, '\r\n');
      
      const csvBuffer = Buffer.from(csvString, 'utf8');
      
      // Add CSV file
      formData.append('File', csvBuffer, {
        filename: 'discount_subgroups.csv',
        contentType: 'text/csv; charset=utf-8'
      });

      // Make POST request with multipart/form-data
      const response = await this.axiosInstance.post(url, formData, {
        headers: {
          'Token': token,
          'Ocp-Apim-Subscription-Key': subscriptionKey || '',
          ...formData.getHeaders()
        }
      });

      logger.info('Discount sub-groups CSV uploaded successfully to TypsForYou', {
        exitCode: response.data?.ExitCode,
        loadedRecords: response.data?.LoadedRecords,
        message: response.data?.ExitMesssage
      });

      return response.data;

    } catch (error: any) {
      const responseData = error.response?.data;
      const message = responseData?.ExitMesssage || responseData?.message || error.message;
      const errors = responseData?.DataErrorsFound;
      
      logger.error('Failed to upload discount sub-groups CSV to TypsForYou:', {
        message,
        errors: errors?.slice(0, 5),
        exitCode: responseData?.ExitCode
      });
      
      const errorDetail = errors && errors.length > 0 
        ? `${message}. Errors: ${JSON.stringify(errors.slice(0, 3))}`
        : message;
      
      throw new AppError(`Failed to upload discount sub-groups CSV: ${errorDetail}`, error.response?.status || 500);
    }
  }

  /**
   * Create/Update articles in TypsForYou via CSV upload
   * @param csvContent CSV file content as string or Buffer
   */
  async uploadArticlesCsv(csvContent: string | Buffer): Promise<any> {
    try {
      // Get provider config
      const config = await prisma.providerConfig.findUnique({
        where: { id: this.providerConfigId }
      });

      if (!config) {
        throw new AppError('Provider config not found', 404);
      }

      // Authenticate
      const token = await this.authenticate();
      
      logger.info('Uploading articles CSV to TypsForYou...');

      // Build articles endpoint URL
      const articlesUrl = `${config.apiUrl}/articles`;

      // Get subscription key
      const subscriptionKey = config.webhookSecret ? CryptoService.decrypt(config.webhookSecret) : null;

      // Create FormData
      const FormData = require('form-data');
      const formData = new FormData();
      
      // Convert string to Buffer with Windows line endings and ensure UTF-8
      let csvString = typeof csvContent === 'string' ? csvContent : csvContent.toString('utf8');
      
      // Normalize to UTF-8 (remove BOM if present and fix encoding issues)
      csvString = csvString.replace(/^\uFEFF/, ''); // Remove BOM
      
      // Remove any trailing whitespace from each line BEFORE converting line endings
      csvString = csvString.split(/\r?\n/).map(line => line.trimEnd()).join('\n');
      
      // Replace LF with CRLF for proper CSV format
      csvString = csvString.replace(/\n/g, '\r\n');
      
      // Debug: Save CSV after conversion
      const fs = require('fs');
      const path = require('path');
      const debugPath = path.join(process.cwd(), `debug_upload_${Date.now()}.csv`);
      fs.writeFileSync(debugPath, csvString, { encoding: 'utf8' });
      logger.info(`Debug: CSV saved to ${debugPath}`);
      
      const csvBuffer = Buffer.from(csvString, 'utf8');
      
      // Add CSV file
      formData.append('File', csvBuffer, {
        filename: 'articles.csv',
        contentType: 'text/csv; charset=utf-8'
      });

      // Make POST request with multipart/form-data
      const response = await this.axiosInstance.post(articlesUrl, formData, {
        headers: {
          'Token': token,
          'Ocp-Apim-Subscription-Key': subscriptionKey || '',
          ...formData.getHeaders()
        }
      });

      logger.info('Articles CSV uploaded successfully to TypsForYou', {
        exitCode: response.data?.ExitCode,
        message: response.data?.ExitMesssage
      });

      return response.data;

    } catch (error: any) {
      const responseData = error.response?.data;
      const message = responseData?.ExitMesssage || responseData?.message || error.message;
      const errors = responseData?.DataErrorsFound;
      
      logger.error('Failed to upload articles CSV to TypsForYou:', {
        message,
        errors: errors?.slice(0, 5), // Log first 5 errors
        exitCode: responseData?.ExitCode
      });
      
      // Include detailed errors in exception
      const errorDetail = errors && errors.length > 0 
        ? `${message}. First errors: ${JSON.stringify(errors.slice(0, 3))}`
        : message;
      
      throw new AppError(`Failed to upload articles CSV: ${errorDetail}`, error.response?.status || 500);
    }
  }

  /**
   * Upload article warehouse (stock/prices) CSV to TypsForYou
   */
  async uploadArticleWarehouseCsv(csvContent: string | Buffer): Promise<any> {
    try {
      // Get provider config
      const config = await prisma.providerConfig.findUnique({
        where: { id: this.providerConfigId }
      });

      if (!config) {
        throw new AppError('Provider config not found', 404);
      }

      // Authenticate
      const token = await this.authenticate();
      
      logger.info('Uploading article warehouse CSV to TypsForYou...');

      // Build articlewarehouse endpoint URL
      const warehouseUrl = `${config.apiUrl}/articlewarehouse`;

      // Get subscription key
      const subscriptionKey = config.webhookSecret ? CryptoService.decrypt(config.webhookSecret) : null;

      // Create FormData
      const FormData = require('form-data');
      const formData = new FormData();
      
      // Convert string to Buffer with Windows line endings and ensure UTF-8
      let csvString = typeof csvContent === 'string' ? csvContent : csvContent.toString('utf8');
      
      // Normalize to UTF-8 (remove BOM if present)
      csvString = csvString.replace(/^\uFEFF/, '');
      
      // Remove trailing whitespace from each line
      csvString = csvString.split(/\r?\n/).map(line => line.trimEnd()).join('\n');
      
      // Replace LF with CRLF
      csvString = csvString.replace(/\n/g, '\r\n');
      
      const csvBuffer = Buffer.from(csvString, 'utf8');
      
      // Add CSV file
      formData.append('File', csvBuffer, {
        filename: 'articlewarehouse.csv',
        contentType: 'text/csv; charset=utf-8'
      });

      // Make POST request
      const response = await this.axiosInstance.post(warehouseUrl, formData, {
        headers: {
          'Token': token,
          'Ocp-Apim-Subscription-Key': subscriptionKey || '',
          ...formData.getHeaders()
        }
      });

      logger.info('Article warehouse CSV uploaded successfully to TypsForYou', {
        exitCode: response.data?.ExitCode,
        message: response.data?.ExitMesssage
      });

      return response.data;

    } catch (error: any) {
      const responseData = error.response?.data;
      const message = responseData?.ExitMesssage || responseData?.message || error.message;
      const errors = responseData?.DataErrorsFound;
      
      logger.error('Failed to upload article warehouse CSV to TypsForYou:', {
        message,
        errors: errors?.slice(0, 5),
        exitCode: responseData?.ExitCode
      });
      
      const errorDetail = errors && errors.length > 0 
        ? `${message}. First errors: ${JSON.stringify(errors.slice(0, 3))}`
        : message;
      
      throw new AppError(`Failed to upload article warehouse CSV: ${errorDetail}`, error.response?.status || 500);
    }
  }

  /**
   * Get existing articles from TypsForYou
   * Returns array of articles with BrandId and PartNumber
   */
  async getExistingArticles(options?: {
    brandId?: string;
    limit?: number;
  }): Promise<Array<{ BrandId: number; PartNumber: string }>> {
    try {
      // Get provider config
      const config = await prisma.providerConfig.findUnique({
        where: { id: this.providerConfigId }
      });

      if (!config) {
        throw new AppError('Provider config not found', 404);
      }

      // Authenticate
      const token = await this.authenticate();
      
      logger.info('Fetching existing articles from TypsForYou...', { options });

      // Build articles endpoint URL
      const articlesUrl = `${config.apiUrl}/articles`;

      // Get subscription key
      const subscriptionKey = config.webhookSecret ? CryptoService.decrypt(config.webhookSecret) : null;

      // Build query parameters
      const params: any = {};
      if (options?.brandId) {
        params.BrandId = options.brandId;
      }
      if (options?.limit) {
        params.PageSize = options.limit;
      }

      // Make GET request
      const response = await this.axiosInstance.get(articlesUrl, {
        headers: {
          'Token': token,
          'Ocp-Apim-Subscription-Key': subscriptionKey || ''
        },
        params
      });

      logger.info('Raw response from TypsForYou GET articles:', {
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        keys: response.data ? Object.keys(response.data).slice(0, 5) : [],
        sample: response.data ? JSON.stringify(response.data).substring(0, 200) : ''
      });

      // Try to extract articles array from various possible structures
      let articles: Array<Record<string, unknown>> = [];
      
      if (Array.isArray(response.data)) {
        // Direct array
        articles = response.data;
      } else if (response.data?.Articles && Array.isArray(response.data.Articles)) {
        // Wrapped in Articles property
        articles = response.data.Articles;
      } else if (response.data?.articles && Array.isArray(response.data.articles)) {
        // Lowercase articles property
        articles = response.data.articles;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        // Wrapped in data property
        articles = response.data.data;
      } else {
        logger.warn('Unexpected response structure from TypsForYou GET articles', {
          responseType: typeof response.data,
          responseKeys: response.data ? Object.keys(response.data) : []
        });
        articles = [];
      }
      
      logger.info(`Fetched ${articles.length} existing articles from TypsForYou`);

      // Extract BrandId and PartNumber
      return articles.map((article: Record<string, unknown>) => ({
        BrandId: (article.BrandId || article.BrandID) as number,
        PartNumber: article.PartNumber as string
      })).filter(a => a.BrandId && a.PartNumber); // Filter out invalid entries

    } catch (error: any) {
      logger.error('Failed to fetch articles from TypsForYou:', {
        message: error.message,
        status: error.response?.status
      });
      
      throw new AppError(`Failed to fetch articles from TypsForYou: ${error.message}`, error.response?.status || 500);
    }
  }

  /**
   * Upload customers CSV to TypsForYou
   */
  async uploadCustomersCsv(csvContent: string | Buffer): Promise<any> {
    try {
      // Get provider config
      const config = await prisma.providerConfig.findUnique({
        where: { id: this.providerConfigId }
      });

      if (!config) {
        throw new AppError('Provider config not found', 404);
      }

      // Authenticate
      const token = await this.authenticate();
      
      logger.info('Uploading customers CSV to TypsForYou...');

      // Build customers endpoint URL
      const customersUrl = `${config.apiUrl}/customers`;

      // Get subscription key
      const subscriptionKey = config.webhookSecret ? CryptoService.decrypt(config.webhookSecret) : null;

      // Create FormData
      const FormData = require('form-data');
      const formData = new FormData();
      
      // Convert string to Buffer with Windows line endings and ensure UTF-8
      let csvString = typeof csvContent === 'string' ? csvContent : csvContent.toString('utf8');
      
      // Normalize to UTF-8 (remove BOM if present)
      csvString = csvString.replace(/^\uFEFF/, '');
      
      // Remove trailing whitespace from each line
      csvString = csvString.split(/\r?\n/).map(line => line.trimEnd()).join('\n');
      
      // Replace LF with CRLF
      csvString = csvString.replace(/\n/g, '\r\n');
      
      const csvBuffer = Buffer.from(csvString, 'utf8');
      
      // Add CSV file
      formData.append('File', csvBuffer, {
        filename: 'customers.csv',
        contentType: 'text/csv; charset=utf-8'
      });

      // Make POST request
      const response = await this.axiosInstance.post(customersUrl, formData, {
        headers: {
          'Token': token,
          'Ocp-Apim-Subscription-Key': subscriptionKey || '',
          ...formData.getHeaders()
        }
      });

      logger.info('Customers CSV uploaded successfully to TypsForYou', {
        exitCode: response.data?.ExitCode,
        message: response.data?.ExitMesssage,
        loadedRecords: response.data?.LoadedRecords
      });

      return response.data;

    } catch (error: any) {
      const responseData = error.response?.data;
      const message = responseData?.ExitMesssage || responseData?.message || error.message;
      const errors = responseData?.DataErrorsFound;
      
      logger.error('Failed to upload customers CSV to TypsForYou:', {
        message,
        errors: errors?.slice(0, 5),
        exitCode: responseData?.ExitCode
      });
      
      const errorDetail = errors && errors.length > 0 
        ? `${message}. First errors: ${JSON.stringify(errors.slice(0, 3))}`
        : message;
      
      throw new AppError(`Failed to upload customers CSV: ${errorDetail}`, error.response?.status || 500);
    }
  }

  /**
   * Update customers CSV in TypsForYou (PATCH method)
   * If PATCH doesn't work, POST usually handles both create and update
   */
  async updateCustomersCsv(csvContent: string | Buffer): Promise<any> {
    try {
      const config = await prisma.providerConfig.findUnique({
        where: { id: this.providerConfigId }
      });

      if (!config) {
        throw new AppError('Provider config not found', 404);
      }

      const token = await this.authenticate();
      
      logger.info('Updating customers CSV in TypsForYou (using PATCH)...');

      const customersUrl = `${config.apiUrl}/customers`;
      const subscriptionKey = config.webhookSecret ? CryptoService.decrypt(config.webhookSecret) : null;

      const FormData = require('form-data');
      const formData = new FormData();
      
      let csvString = typeof csvContent === 'string' ? csvContent : csvContent.toString('utf8');
      csvString = csvString.replace(/^\uFEFF/, '');
      csvString = csvString.split(/\r?\n/).map(line => line.trimEnd()).join('\n');
      csvString = csvString.replace(/\n/g, '\r\n');
      
      const csvBuffer = Buffer.from(csvString, 'utf8');
      
      formData.append('File', csvBuffer, {
        filename: 'customers.csv',
        contentType: 'text/csv; charset=utf-8'
      });

      // Try PATCH first, if it fails, use POST (which usually handles updates too)
      let response;
      try {
        response = await this.axiosInstance.patch(customersUrl, formData, {
          headers: {
            'Token': token,
            'Ocp-Apim-Subscription-Key': subscriptionKey || '',
            ...formData.getHeaders()
          }
        });
      } catch (patchError: any) {
        if (patchError.response?.status === 404 || patchError.response?.status === 405) {
          logger.info('PATCH not supported, using POST for update...');
          response = await this.axiosInstance.post(customersUrl, formData, {
            headers: {
              'Token': token,
              'Ocp-Apim-Subscription-Key': subscriptionKey || '',
              ...formData.getHeaders()
            }
          });
        } else {
          throw patchError;
        }
      }

      logger.info('Customers CSV updated successfully in TypsForYou', {
        exitCode: response.data?.ExitCode,
        message: response.data?.ExitMesssage,
        loadedRecords: response.data?.LoadedRecords
      });

      return response.data;

    } catch (error: any) {
      const responseData = error.response?.data;
      const message = responseData?.ExitMesssage || responseData?.message || error.message;
      const errors = responseData?.DataErrorsFound;
      
      logger.error('Failed to update customers CSV in TypsForYou:', {
        message,
        errors: errors?.slice(0, 5),
        exitCode: responseData?.ExitCode
      });
      
      const errorDetail = errors && errors.length > 0 
        ? `${message}. First errors: ${JSON.stringify(errors.slice(0, 3))}`
        : message;
      
      throw new AppError(`Failed to update customers CSV: ${errorDetail}`, error.response?.status || 500);
    }
  }

  /**
   * Upload customer discount groups CSV to TypsForYou
   */
  async uploadCustomerDiscountGroupsCsv(csvContent: string | Buffer): Promise<any> {
    try {
      const config = await prisma.providerConfig.findUnique({
        where: { id: this.providerConfigId }
      });

      if (!config) {
        throw new AppError('Provider config not found', 404);
      }

      const token = await this.authenticate();
      logger.info('Uploading customer discount groups CSV to TypsForYou...');

      const url = `${config.apiUrl}/customerdiscountgroup`;
      const subscriptionKey = config.webhookSecret ? CryptoService.decrypt(config.webhookSecret) : null;

      const FormData = require('form-data');
      const formData = new FormData();
      
      let csvString = typeof csvContent === 'string' ? csvContent : csvContent.toString('utf8');
      csvString = csvString.replace(/^\uFEFF/, '');
      csvString = csvString.split(/\r?\n/).map(line => line.trimEnd()).join('\n');
      csvString = csvString.replace(/\n/g, '\r\n');
      
      const csvBuffer = Buffer.from(csvString, 'utf8');
      
      formData.append('File', csvBuffer, {
        filename: 'customerdiscountgroup.csv',
        contentType: 'text/csv; charset=utf-8'
      });

      const response = await this.axiosInstance.post(url, formData, {
        headers: {
          'Token': token,
          'Ocp-Apim-Subscription-Key': subscriptionKey || '',
          ...formData.getHeaders()
        }
      });

      logger.info('Customer discount groups CSV uploaded successfully', {
        exitCode: response.data?.ExitCode,
        message: response.data?.ExitMesssage,
        loadedRecords: response.data?.LoadedRecords
      });

      return response.data;

    } catch (error: any) {
      const responseData = error.response?.data;
      const message = responseData?.ExitMesssage || responseData?.message || error.message;
      const errors = responseData?.DataErrorsFound;
      
      logger.error('Failed to upload customer discount groups CSV:', {
        message,
        errors: errors?.slice(0, 5),
        exitCode: responseData?.ExitCode
      });
      
      const errorDetail = errors && errors.length > 0 
        ? `${message}. First errors: ${JSON.stringify(errors.slice(0, 3))}`
        : message;
      
      throw new AppError(`Failed to upload customer discount groups CSV: ${errorDetail}`, error.response?.status || 500);
    }
  }

  /**
   * Upload customer warehouses CSV to TypsForYou
   */
  async uploadCustomerWarehousesCsv(csvContent: string | Buffer): Promise<any> {
    try {
      const config = await prisma.providerConfig.findUnique({
        where: { id: this.providerConfigId }
      });

      if (!config) {
        throw new AppError('Provider config not found', 404);
      }

      const token = await this.authenticate();
      logger.info('Uploading customer warehouses CSV to TypsForYou...');

      const url = `${config.apiUrl}/customerswarehouses`;
      const subscriptionKey = config.webhookSecret ? CryptoService.decrypt(config.webhookSecret) : null;

      const FormData = require('form-data');
      const formData = new FormData();
      
      let csvString = typeof csvContent === 'string' ? csvContent : csvContent.toString('utf8');
      csvString = csvString.replace(/^\uFEFF/, '');
      csvString = csvString.split(/\r?\n/).map(line => line.trimEnd()).join('\n');
      csvString = csvString.replace(/\n/g, '\r\n');
      
      const csvBuffer = Buffer.from(csvString, 'utf8');
      
      formData.append('File', csvBuffer, {
        filename: 'customerswarehouses.csv',
        contentType: 'text/csv; charset=utf-8'
      });

      const response = await this.axiosInstance.post(url, formData, {
        headers: {
          'Token': token,
          'Ocp-Apim-Subscription-Key': subscriptionKey || '',
          ...formData.getHeaders()
        }
      });

      logger.info('Customer warehouses CSV uploaded successfully', {
        exitCode: response.data?.ExitCode,
        message: response.data?.ExitMesssage,
        loadedRecords: response.data?.LoadedRecords
      });

      return response.data;

    } catch (error: any) {
      const responseData = error.response?.data;
      const message = responseData?.ExitMesssage || responseData?.message || error.message;
      const errors = responseData?.DataErrorsFound;
      
      logger.error('Failed to upload customer warehouses CSV:', {
        message,
        errors: errors?.slice(0, 5),
        exitCode: responseData?.ExitCode
      });
      
      const errorDetail = errors && errors.length > 0 
        ? `${message}. First errors: ${JSON.stringify(errors.slice(0, 3))}`
        : message;
      
      throw new AppError(`Failed to upload customer warehouses CSV: ${errorDetail}`, error.response?.status || 500);
    }
  }

  /**
   * Get orders from TypsForYou API
   * @param filters - Optional filters for OrderID
   * @returns Array of orders with details
   */
  async getOrders(filters?: {
    orderId?: string;
  }): Promise<unknown> {
    try {
      // Get provider config
      const config = await prisma.providerConfig.findUnique({
        where: { id: this.providerConfigId }
      });

      if (!config?.apiUrl) {
        throw new AppError('API URL not configured', 400);
      }

      // Authenticate
      const token = await this.authenticate();

      // Get subscription key
      const subscriptionKey = config.webhookSecret ? CryptoService.decrypt(config.webhookSecret) : null;

      if (!subscriptionKey) {
        throw new AppError('Subscription key not configured', 400);
      }

      // Build orders endpoint URL
      const ordersUrl = `${config.apiUrl.replace(/\/$/, '')}/orders`;
      
      // Build query parameters
      const params = new URLSearchParams();
      if (filters?.orderId) {
        params.append('OrderID', filters.orderId);
      }

      const url = params.toString() ? `${ordersUrl}?${params.toString()}` : ordersUrl;

      logger.info('Fetching orders from TypsForYou', { 
        url,
        hasToken: !!token,
        hasSubscriptionKey: !!subscriptionKey
      });

      // Make request with Token header and subscription key
      const response = await this.axiosInstance.get(url, {
        headers: {
          'Token': token,
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Accept': 'application/json'
        }
      });

      logger.info('Orders fetched successfully', {
        count: Array.isArray(response.data?.Table) ? response.data.Table.length : 'unknown'
      });

      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number; data?: { message?: string; ExitMesssage?: string; StartTime?: string; EndTime?: string; Duration?: string } }; message?: string };
      
      // TypsForYou returns 400 with "Não foram encontrados registos" when no orders exist
      if (axiosError.response?.status === 400 && 
          axiosError.response?.data?.ExitMesssage?.includes('Não foram encontrados registos')) {
        logger.info('No orders found (empty result)');
        return {
          StartTime: axiosError.response.data.StartTime,
          EndTime: axiosError.response.data.EndTime,
          Duration: axiosError.response.data.Duration,
          Table: [],
          ExitCode: '200',
          ExitMesssage: 'No records found'
        };
      }

      const message = axiosError.response?.data?.ExitMesssage || axiosError.response?.data?.message || axiosError.message || 'Unknown error';
      logger.error('Failed to fetch orders:', {
        message,
        status: axiosError.response?.status,
        filters
      });
      
      throw new AppError(`Failed to fetch orders: ${message}`, axiosError.response?.status || 500);
    }
  }
}
