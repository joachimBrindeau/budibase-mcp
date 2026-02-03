import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import NodeCache from 'node-cache';
import { config } from '../config';
import type {
  BudibaseApp,
  BudibaseQuery,
  BudibaseRecord,
  BudibaseTable,
  BudibaseUser,
  QueryRequest,
  QueryResponse,
} from '../types/budibase';
import { BudibaseError } from '../utils/errors';
import { logger } from '../utils/logger';

export class BudibaseClient {
  protected client: AxiosInstance;
  protected cache: NodeCache;
  protected connectionError: BudibaseError | null = null;

  constructor() {
    this.cache = new NodeCache({ stdTTL: config.server.cacheTtl });

    this.client = axios.create({
      baseURL: `${config.budibase.url}/api/public/v1`,
      timeout: config.server.requestTimeout,
      headers: {
        'Content-Type': 'application/json',
        'x-budibase-api-key': config.budibase.apiKey,
      },
    });

    axiosRetry(this.client, {
      retries: config.server.maxRetries,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429 ||
          (error.response?.status ?? 0) >= 500
        );
      },
      onRetry: (retryCount, error) => {
        logger.warn('Retrying request', {
          attempt: retryCount,
          url: error.config?.url,
          status: error.response?.status,
        });
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor for logging
    this.client.interceptors.request.use((config) => {
      logger.debug('Budibase API Request', {
        method: config.method,
        url: config.url,
        params: config.params,
      });
      return config;
    });
    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.debug('Budibase API Response', {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error('Budibase API Error', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.response?.data?.message || error.message,
        });
        throw new BudibaseError(error.response?.data?.message || error.message, error.response?.status || 500);
      },
    );
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Testing Budibase connection...');
      // Test connection using the public API status endpoint
      await this.client.get('/metrics');
      logger.info('Budibase connection successful');
      this.connectionError = null;
    } catch (error) {
      const budiError =
        error instanceof BudibaseError
          ? error
          : new BudibaseError(error instanceof Error ? error.message : 'Connection failed');
      this.connectionError = budiError;
      logger.warn('Budibase connection failed - server will start but API calls may fail', {
        error: budiError.toUserMessage(),
      });
    }
  }

  isConnected(): boolean {
    return this.connectionError === null;
  }

  getConnectionError(): string | null {
    return this.connectionError?.toUserMessage() ?? null;
  }

  ensureConnected(): void {
    if (this.connectionError) {
      throw this.connectionError;
    }
  }

  // Application Management
  async getApplications(): Promise<BudibaseApp[]> {
    const cacheKey = 'applications';
    const cached = this.cache.get<BudibaseApp[]>(cacheKey);
    if (cached) return cached;

    const response = await this.client.post('/applications/search', { name: '' });
    let apps = response.data.data || response.data;

    // Fix app IDs: Convert dev IDs to production IDs for the public API
    apps = apps.map((app: BudibaseApp) => ({
      ...app,
      // Keep original metadata ID as _metadataId for reference
      _metadataId: app._id,
      // Convert dev app ID to production ID by removing _dev
      _id: app._id?.replace('_dev_', '_') || app._id,
      // Add a flag to indicate if ID was corrected
      _idCorrected: !!app._id?.includes('_dev_'),
    }));

    logger.debug('Applications loaded with ID correction', {
      count: apps.length,
      corrected: apps.filter((app: BudibaseApp) => app._idCorrected).length,
    });

    this.cache.set(cacheKey, apps);
    return apps;
  }

  async getApplication(appId: string): Promise<BudibaseApp> {
    const cacheKey = `application:${appId}`;
    const cached = this.cache.get<BudibaseApp>(cacheKey);
    if (cached) return cached;

    // Get all apps and find the specific one
    // This is more reliable than individual app endpoints which may return HTML
    const apps = await this.getApplications();
    const app = apps.find(
      (a) => a._id === appId || a._metadataId === appId || a.name.toLowerCase() === appId.toLowerCase(),
    );

    if (!app) {
      throw new BudibaseError(`Application not found: ${appId}`, 404);
    }

    this.cache.set(cacheKey, app);
    return app;
  }

  /**
   * Resolve table ID from name or ID
   */
  protected async resolveTableId(appId: string, tableIdOrName: string): Promise<string> {
    const tables = await this.getTables(appId);
    const table = tables.find((t) => t._id === tableIdOrName || t.name.toLowerCase() === tableIdOrName.toLowerCase());
    return table?._id || tableIdOrName;
  }

  /**
   * Resolve app ID - handles both metadata IDs and instance IDs
   */
  protected async resolveAppId(appId: string): Promise<string> {
    try {
      // If it looks like a proper app ID, try it first
      if (appId.startsWith('app_') && appId.length > 20) {
        return appId;
      }

      // Otherwise, get all apps and find the matching one
      const apps = await this.getApplications();

      // Try to find by name first (most user-friendly)
      const byName = apps.find((app) => app.name.toLowerCase() === appId.toLowerCase());
      if (byName) {
        logger.debug('Resolved app by name', { input: appId, resolved: byName._id });
        return byName._id;
      }

      // Try to find by metadata ID
      const byMetadataId = apps.find((app) => app._metadataId === appId);
      if (byMetadataId) {
        logger.debug('Resolved app by metadata ID', { input: appId, resolved: byMetadataId._id });
        return byMetadataId._id;
      }

      // Try to find by instance ID (exact match)
      const byInstanceId = apps.find((app) => app._id === appId);
      if (byInstanceId) {
        return appId;
      }

      // If nothing found, return original and let it fail with proper error
      logger.warn('Could not resolve app ID', {
        input: appId,
        availableApps: apps.map((a) => ({ name: a.name, id: a._id, metadataId: a._metadataId })),
      });
      return appId;
    } catch (error) {
      logger.error('Error resolving app ID', error);
      return appId;
    }
  }

  async createApplication(data: Partial<BudibaseApp>): Promise<BudibaseApp> {
    const response = await this.client.post('/applications', data);
    this.cache.del('applications'); // Invalidate cache
    return response.data.data || response.data;
  }

  async updateApplication(appId: string, data: Partial<BudibaseApp>): Promise<BudibaseApp> {
    const response = await this.client.put(`/applications/${appId}`, data);
    this.cache.del('applications');
    this.cache.del(`application:${appId}`);
    return response.data.data || response.data;
  }

  async deleteApplication(appId: string): Promise<void> {
    await this.client.delete(`/applications/${appId}`);
    this.cache.del('applications');
    this.cache.del(`application:${appId}`);
  }

  async publishApplication(appId: string): Promise<void> {
    await this.client.post(`/applications/${appId}/publish`);
    this.cache.del(`application:${appId}`);
  }

  async unpublishApplication(appId: string): Promise<void> {
    await this.client.post(`/applications/${appId}/unpublish`);
    this.cache.del(`application:${appId}`);
  }

  // Table and Schema Management
  async getTables(appId: string): Promise<BudibaseTable[]> {
    const resolvedId = await this.resolveAppId(appId);
    const cacheKey = `tables:${resolvedId}`;
    const cached = this.cache.get<BudibaseTable[]>(cacheKey);
    if (cached) return cached;

    const response = await this.client.post(
      '/tables/search',
      { name: '' },
      {
        headers: { 'x-budibase-app-id': resolvedId },
      },
    );
    const tables = response.data.data || response.data;
    this.cache.set(cacheKey, tables);
    return tables;
  }

  async getTable(appId: string, tableId: string): Promise<BudibaseTable> {
    const resolvedAppId = await this.resolveAppId(appId);
    const resolvedTableId = await this.resolveTableId(appId, tableId);
    const cacheKey = `table:${resolvedAppId}:${resolvedTableId}`;
    const cached = this.cache.get<BudibaseTable>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get(`/tables/${resolvedTableId}`, {
      headers: { 'x-budibase-app-id': resolvedAppId },
    });
    const table = response.data.data || response.data;
    this.cache.set(cacheKey, table);
    return table;
  }

  async createTable(appId: string, tableData: Partial<BudibaseTable>): Promise<BudibaseTable> {
    const resolvedId = await this.resolveAppId(appId);
    const response = await this.client.post('/tables', tableData, {
      headers: { 'x-budibase-app-id': resolvedId },
    });
    this.cache.del(`tables:${resolvedId}`);
    return response.data.data || response.data;
  }

  async updateTable(appId: string, tableId: string, tableData: Partial<BudibaseTable>): Promise<BudibaseTable> {
    const resolvedAppId = await this.resolveAppId(appId);
    const resolvedTableId = await this.resolveTableId(appId, tableId);
    const response = await this.client.put(`/tables/${resolvedTableId}`, tableData, {
      headers: { 'x-budibase-app-id': resolvedAppId },
    });
    this.cache.del(`tables:${resolvedAppId}`);
    this.cache.del(`table:${resolvedAppId}:${resolvedTableId}`);
    return response.data.data || response.data;
  }

  async deleteTable(appId: string, tableId: string): Promise<void> {
    const resolvedAppId = await this.resolveAppId(appId);
    const resolvedTableId = await this.resolveTableId(appId, tableId);
    await this.client.delete(`/tables/${resolvedTableId}`, {
      headers: { 'x-budibase-app-id': resolvedAppId },
    });
    this.cache.del(`tables:${resolvedAppId}`);
    this.cache.del(`table:${resolvedAppId}:${resolvedTableId}`);
  }

  // Record Operations
  async queryRecords(appId: string, request: QueryRequest): Promise<QueryResponse> {
    const resolvedAppId = await this.resolveAppId(appId);
    const { tableId, ...searchRequest } = request;
    const resolvedTableId = await this.resolveTableId(appId, tableId);
    const response = await this.client.post(`/tables/${resolvedTableId}/rows/search`, searchRequest, {
      headers: { 'x-budibase-app-id': resolvedAppId },
    });
    return response.data;
  }

  async getRecord(appId: string, tableId: string, recordId: string): Promise<BudibaseRecord> {
    const resolvedAppId = await this.resolveAppId(appId);
    const resolvedTableId = await this.resolveTableId(appId, tableId);
    const response = await this.client.get(`/tables/${resolvedTableId}/rows/${recordId}`, {
      headers: { 'x-budibase-app-id': resolvedAppId },
    });
    const record = response.data.data || response.data;
    return this.normalizeLinkedFields(resolvedAppId, resolvedTableId, record);
  }

  /**
   * Normalize linked fields from full nested records to {_id, primaryDisplay}.
   * GET /rows/:id returns full nested objects for links,
   * while POST /rows/search returns {_id, primaryDisplay}. This aligns both.
   */
  private async normalizeLinkedFields(appId: string, tableId: string, record: BudibaseRecord): Promise<BudibaseRecord> {
    const table = await this.getTable(appId, tableId);
    const linkFields = Object.entries(table.schema)
      .filter(([, field]) => field.type === 'link')
      .map(([name, field]) => ({ name, targetTableId: field.tableId }));

    if (!linkFields.length) return record;

    const normalized: Record<string, unknown> = { ...record };
    for (const { name, targetTableId } of linkFields) {
      const value = normalized[name];
      if (!Array.isArray(value) || !value.length) continue;
      const linkedRecords = value as Record<string, unknown>[];
      if (linkedRecords[0].primaryDisplay !== undefined) continue;

      if (!targetTableId) {
        logger.warn('Link field missing targetTableId in schema', { field: name, tableId });
        continue;
      }

      const targetTable = await this.getTable(appId, targetTableId);
      const displayField =
        targetTable.primaryDisplay ||
        Object.entries(targetTable.schema).find(([, f]) => f.type === 'string')?.[0] ||
        '_id';
      normalized[name] = linkedRecords.map((item) => ({
        _id: item._id,
        primaryDisplay: item[displayField] ?? item._id,
      }));
    }
    return normalized as BudibaseRecord;
  }

  async createRecord(appId: string, tableId: string, data: Record<string, unknown>): Promise<BudibaseRecord> {
    const resolvedAppId = await this.resolveAppId(appId);
    const resolvedTableId = await this.resolveTableId(appId, tableId);
    const response = await this.client.post(`/tables/${resolvedTableId}/rows`, data, {
      headers: { 'x-budibase-app-id': resolvedAppId },
    });
    const record = response.data.data || response.data;
    return this.normalizeLinkedFields(resolvedAppId, resolvedTableId, record);
  }

  async updateRecord(
    appId: string,
    tableId: string,
    recordId: string,
    data: Record<string, unknown>,
  ): Promise<BudibaseRecord> {
    const resolvedAppId = await this.resolveAppId(appId);
    const resolvedTableId = await this.resolveTableId(appId, tableId);
    const response = await this.client.put(`/tables/${resolvedTableId}/rows/${recordId}`, data, {
      headers: { 'x-budibase-app-id': resolvedAppId },
    });
    const record = response.data.data || response.data;
    return this.normalizeLinkedFields(resolvedAppId, resolvedTableId, record);
  }

  async deleteRecord(appId: string, tableId: string, recordId: string): Promise<void> {
    const resolvedAppId = await this.resolveAppId(appId);
    const resolvedTableId = await this.resolveTableId(appId, tableId);
    await this.client.delete(`/tables/${resolvedTableId}/rows/${recordId}`, {
      headers: { 'x-budibase-app-id': resolvedAppId },
    });
  }

  // User Management
  async getUsers(): Promise<BudibaseUser[]> {
    const cacheKey = 'users';
    const cached = this.cache.get<BudibaseUser[]>(cacheKey);
    if (cached) return cached;

    // Use search endpoint instead of GET /users which returns "No content found"
    const response = await this.client.post('/users/search', {});
    const users = response.data.data || response.data;
    this.cache.set(cacheKey, users);
    return users;
  }

  async createUser(userData: Partial<BudibaseUser>): Promise<BudibaseUser> {
    const response = await this.client.post('/users', userData);
    this.cache.del('users');
    return response.data.data || response.data;
  }

  async updateUser(userId: string, userData: Partial<BudibaseUser>): Promise<BudibaseUser> {
    const response = await this.client.put(`/users/${userId}`, userData);
    this.cache.del('users');
    this.cache.del(`user:${userId}`);
    return response.data.data || response.data;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.client.delete(`/users/${userId}`);
    this.cache.del('users');
    this.cache.del(`user:${userId}`);
  }

  // Query Management
  async searchQueries(appId?: string): Promise<BudibaseQuery[]> {
    const headers = appId ? { 'x-budibase-app-id': await this.resolveAppId(appId) } : {};
    const response = await this.client.post('/queries/search', {}, { headers });
    return response.data.data || response.data;
  }

  async executeQuery(queryId: string, parameters?: Record<string, unknown>): Promise<unknown> {
    const response = await this.client.post(`/queries/${queryId}`, { parameters });
    return response.data.data || response.data;
  }

  // Cache Management
  clearCache(): void {
    this.cache.flushAll();
    logger.info('Budibase client cache cleared');
  }

  getCacheStats(): { keys: number; size: string } {
    const stats = this.cache.getStats();
    return {
      keys: stats.keys,
      size: `${(stats.vsize / 1024 / 1024).toFixed(2)} MB`,
    };
  }
}
