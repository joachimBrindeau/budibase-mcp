import { BudibaseClient } from '../clients/budibase';
import { SchemaRegistry } from './schema-registry';
import { SmartQueryBuilder } from './smart-query-builder';
import { BudibaseApp, BudibaseTable, QueryRequest } from '../types/budibase';
import { logger } from '../utils/logger';

export interface SyncOptions {
  forceSync?: boolean;
  syncInterval?: number;
  onSchemaChange?: (change: any) => void;
}

export class EnhancedBudibaseClient extends BudibaseClient {
  private schemaRegistry: SchemaRegistry;
  private queryBuilder: SmartQueryBuilder;
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.schemaRegistry = new SchemaRegistry();
    this.queryBuilder = new SmartQueryBuilder(this.schemaRegistry);
  }

  async initialize(): Promise<void> {
    await super.initialize();
    await this.schemaRegistry.initialize();
    
    // Set up schema change listener
    this.schemaRegistry.on('schemaChanged', (change) => {
      logger.info('Schema changed', change);
    });
  }

  async syncApplication(appId: string, options: SyncOptions = {}): Promise<void> {
    try {
      // Check if sync is needed
      if (!options.forceSync && !await this.schemaRegistry.needsSync(appId)) {
        logger.debug('Application schema is up to date', { appId });
        return;
      }

      // Fetch fresh data
      const app = await this.getApplication(appId);
      const tables = await this.getTables(appId);

      // Sync to registry
      await this.schemaRegistry.syncApplication(app, tables);

      // Set up auto-sync if requested
      if (options.syncInterval && options.syncInterval > 0) {
        this.setupAutoSync(appId, options.syncInterval);
      }

      // Call schema change handler if provided
      if (options.onSchemaChange) {
        this.schemaRegistry.on('schemaChanged', options.onSchemaChange);
      }
    } catch (error) {
      logger.error('Failed to sync application', { appId, error });
      throw error;
    }
  }

  async queryRecordsWithValidation(
    appId: string,
    tableId: string,
    query: Partial<QueryRequest>
  ): Promise<any> {
    // Ensure schema is synced
    await this.ensureSchemaSync(appId, tableId);

    // Build and validate query
    const optimizedQuery = await this.queryBuilder.buildQuery(tableId, query);

    // Log query optimization hints
    if (optimizedQuery.hints) {
      logger.debug('Query optimization', {
        tableId,
        complexity: optimizedQuery.hints.complexity,
        useIndex: optimizedQuery.hints.useIndex
      });
    }

    // Execute query using parent class method
    return await super.queryRecords(appId, { ...optimizedQuery, tableId });
  }

  async getTableSchemaFromCache(tableId: string): Promise<BudibaseTable | null> {
    return await this.schemaRegistry.getTableSchema(tableId);
  }

  async getApplicationTablesFromCache(appId: string): Promise<BudibaseTable[]> {
    return await this.schemaRegistry.getApplicationTables(appId);
  }

  async getSchemaHistory(tableId: string): Promise<any[]> {
    return await this.schemaRegistry.getSchemaHistory(tableId);
  }

  async suggestQuery(tableId: string, description: string): Promise<Partial<QueryRequest>> {
    await this.ensureSchemaSync('', tableId);
    return await this.queryBuilder.suggestQuery(tableId, description);
  }

  private async ensureSchemaSync(appId: string, tableId: string): Promise<void> {
    const table = await this.schemaRegistry.getTableSchema(tableId);
    if (!table) {
      // Schema not in cache, need to sync
      if (!appId) {
        // Try to find app ID from table ID
        const apps = await this.getApplications();
        for (const app of apps) {
          const tables = await this.getTables(app._id);
          if (tables.some(t => t._id === tableId)) {
            appId = app._id;
            break;
          }
        }
      }
      
      if (appId) {
        await this.syncApplication(appId);
      } else {
        throw new Error(`Cannot find application for table ${tableId}`);
      }
    }
  }

  private setupAutoSync(appId: string, interval: number): void {
    // Clear existing interval if any
    const existing = this.syncIntervals.get(appId);
    if (existing) {
      clearInterval(existing);
    }

    // Set up new interval
    const intervalId = setInterval(async () => {
      try {
        await this.syncApplication(appId, { forceSync: true });
      } catch (error) {
        logger.error('Auto-sync failed', { appId, error });
      }
    }, interval);

    this.syncIntervals.set(appId, intervalId);
    logger.info('Auto-sync enabled', { appId, interval });
  }

  async close(): Promise<void> {
    // Clear all sync intervals
    this.syncIntervals.forEach(interval => clearInterval(interval));
    this.syncIntervals.clear();

    // Close schema registry
    await this.schemaRegistry.close();
  }
}
