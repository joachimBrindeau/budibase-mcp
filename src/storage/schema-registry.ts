import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { BudibaseApp, BudibaseTable, BudibaseField } from '../types/budibase';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

interface SchemaVersion {
  id: number;
  appId: string;
  tableId: string;
  version: number;
  schema: Record<string, BudibaseField>;
  createdAt: Date;
  checksum: string;
}

interface AppMetadata {
  appId: string;
  name: string;
  url?: string;
  status: string;
  lastSynced: Date;
  metadata: Record<string, any>;
}

export class SchemaRegistry extends EventEmitter {
  private db: Database | null = null;
  private schemaCache: Map<string, BudibaseTable> = new Map();
  private appCache: Map<string, AppMetadata> = new Map();
  private dbPath: string;

  constructor(dbPath?: string) {
    super();
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'schema-registry.db');
  }

  async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      const { mkdir } = await import('fs/promises');
      await mkdir(dataDir, { recursive: true });

      // Open SQLite database
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      });

      // Create tables
      await this.createTables();
      
      // Load cache
      await this.loadCache();
      
      logger.info('Schema Registry initialized', { dbPath: this.dbPath });
    } catch (error) {
      logger.error('Failed to initialize Schema Registry', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Applications table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS applications (
        app_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT,
        status TEXT,
        last_synced DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tables table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS tables (
        table_id TEXT PRIMARY KEY,
        app_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT,
        primary_display TEXT,
        schema TEXT NOT NULL,
        last_synced DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (app_id) REFERENCES applications(app_id)
      )
    `);

    // Schema versions table for tracking changes
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id TEXT NOT NULL,
        table_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        schema TEXT NOT NULL,
        checksum TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (app_id) REFERENCES applications(app_id),
        FOREIGN KEY (table_id) REFERENCES tables(table_id)
      )
    `);

    // Indexes for performance
    await this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tables_app_id ON tables(app_id);
      CREATE INDEX IF NOT EXISTS idx_schema_versions_table_id ON schema_versions(table_id);
      CREATE INDEX IF NOT EXISTS idx_applications_last_synced ON applications(last_synced);
    `);
  }

  private async loadCache(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Load applications
    const apps = await this.db.all<AppMetadata[]>(
      'SELECT * FROM applications'
    );
    apps.forEach(app => {
      app.metadata = JSON.parse(app.metadata as any || '{}');
      this.appCache.set(app.appId, app);
    });

    // Load tables
    const tables = await this.db.all(
      'SELECT * FROM tables'
    );
    tables.forEach(table => {
      const budibaseTable: BudibaseTable = {
        _id: table.table_id,
        name: table.name,
        type: table.type as 'table' | 'view',
        schema: JSON.parse(table.schema),
        primaryDisplay: table.primary_display
      };
      this.schemaCache.set(table.table_id, budibaseTable);
    });

    logger.info('Schema cache loaded', {
      applications: this.appCache.size,
      tables: this.schemaCache.size
    });
  }

  async syncApplication(app: BudibaseApp, tables: BudibaseTable[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tx = await this.db.run('BEGIN TRANSACTION');
    
    try {
      // Update or insert application
      await this.db.run(`
        INSERT INTO applications (app_id, name, url, status, metadata, last_synced)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(app_id) DO UPDATE SET
          name = excluded.name,
          url = excluded.url,
          status = excluded.status,
          metadata = excluded.metadata,
          last_synced = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      `, [app._id, app.name, app.url, app.status, JSON.stringify({
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
        tenantId: app.tenantId,
        template: app.template
      })]);

      // Update tables
      for (const table of tables) {
        const schemaJson = JSON.stringify(table.schema);
        const checksum = this.calculateChecksum(schemaJson);

        // Check if schema changed
        const existing = await this.db.get(
          'SELECT schema FROM tables WHERE table_id = ?',
          [table._id]
        );

        if (!existing || this.calculateChecksum(existing.schema) !== checksum) {
          // Update table
          await this.db.run(`
            INSERT INTO tables (table_id, app_id, name, type, primary_display, schema)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(table_id) DO UPDATE SET
              name = excluded.name,
              type = excluded.type,
              primary_display = excluded.primary_display,
              schema = excluded.schema,
              last_synced = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          `, [table._id, app._id, table.name, table.type, table.primaryDisplay, schemaJson]);

          // Add schema version
          const version = await this.getNextVersion(table._id);
          await this.db.run(`
            INSERT INTO schema_versions (app_id, table_id, version, schema, checksum)
            VALUES (?, ?, ?, ?, ?)
          `, [app._id, table._id, version, schemaJson, checksum]);

          // Emit schema change event
          this.emit('schemaChanged', {
            appId: app._id,
            tableId: table._id,
            version,
            previousSchema: existing ? JSON.parse(existing.schema) : null,
            newSchema: table.schema
          });
        }

        // Update cache
        this.schemaCache.set(table._id, table);
      }

      // Update app cache
      this.appCache.set(app._id, {
        appId: app._id,
        name: app.name,
        url: app.url,
        status: app.status,
        lastSynced: new Date(),
        metadata: {
          createdAt: app.createdAt,
          updatedAt: app.updatedAt,
          tenantId: app.tenantId,
          template: app.template
        }
      });

      await this.db.run('COMMIT');
      logger.info('Application synced successfully', { 
        appId: app._id, 
        tables: tables.length 
      });
    } catch (error) {
      await this.db.run('ROLLBACK');
      logger.error('Failed to sync application', error);
      throw error;
    }
  }

  async getTableSchema(tableId: string): Promise<BudibaseTable | null> {
    // Check cache first
    if (this.schemaCache.has(tableId)) {
      return this.schemaCache.get(tableId)!;
    }

    // Load from database
    if (!this.db) throw new Error('Database not initialized');
    
    const table = await this.db.get(
      'SELECT * FROM tables WHERE table_id = ?',
      [tableId]
    );

    if (!table) return null;

    const budibaseTable: BudibaseTable = {
      _id: table.table_id,
      name: table.name,
      type: table.type as 'table' | 'view',
      schema: JSON.parse(table.schema),
      primaryDisplay: table.primary_display
    };

    // Update cache
    this.schemaCache.set(tableId, budibaseTable);
    
    return budibaseTable;
  }

  async getApplicationTables(appId: string): Promise<BudibaseTable[]> {
    if (!this.db) throw new Error('Database not initialized');

    const tables = await this.db.all(
      'SELECT * FROM tables WHERE app_id = ?',
      [appId]
    );

    return tables.map(table => ({
      _id: table.table_id,
      name: table.name,
      type: table.type as 'table' | 'view',
      schema: JSON.parse(table.schema),
      primaryDisplay: table.primary_display
    }));
  }

  async getSchemaHistory(tableId: string): Promise<SchemaVersion[]> {
    if (!this.db) throw new Error('Database not initialized');

    const versions = await this.db.all(
      'SELECT * FROM schema_versions WHERE table_id = ? ORDER BY version DESC',
      [tableId]
    );

    return versions.map(v => ({
      ...v,
      schema: JSON.parse(v.schema),
      createdAt: new Date(v.created_at)
    }));
  }

  async needsSync(appId: string, maxAge: number = 3600000): Promise<boolean> {
    const app = this.appCache.get(appId);
    if (!app) return true;

    const age = Date.now() - app.lastSynced.getTime();
    return age > maxAge;
  }

  private calculateChecksum(data: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(data).digest('hex');
  }

  private async getNextVersion(tableId: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.get(
      'SELECT MAX(version) as max_version FROM schema_versions WHERE table_id = ?',
      [tableId]
    );

    return (result?.max_version || 0) + 1;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
    this.schemaCache.clear();
    this.appCache.clear();
  }
}
