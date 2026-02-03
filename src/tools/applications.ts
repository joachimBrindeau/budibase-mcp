import { z } from 'zod';
import { MCPTool } from '../types/mcp';
import { BudibaseClient } from '../clients/budibase';
import { validateSchema, AppIdSchema } from '../utils/validation';
import { logger } from '../utils/logger';

const CreateAppSchema = z.object({
  name: z.string().min(1, 'App name is required'),
  url: z.string().optional(),
  template: z.string().optional(),
});

const UpdateAppSchema = z.object({
  appId: AppIdSchema,
  name: z.string().optional(),
  url: z.string().optional(),
});

const PublishAppSchema = z.object({
  appId: AppIdSchema,
});

const ImportAppSchema = z.object({
  appId: AppIdSchema,
  data: z.any(),
});

export const applicationTools: MCPTool[] = [
  {
    name: 'discover_apps',
    description: 'Discover and explore your Budibase applications with detailed structure information',
    inputSchema: {
      type: 'object',
      properties: {
        includeTables: { 
          type: 'boolean', 
          description: 'Include table structure for each app (default: true)',
          default: true 
        },
      },
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(z.object({
        includeTables: z.boolean().default(true)
      }), args);
      
      logger.info('Discovering applications');
      
      const apps = await client.getApplications();
      
      const appsWithDetails = await Promise.all(apps.map(async (app) => {
        const appInfo = {
          name: app.name,
          id: app._id,
          metadataId: app._metadataId,
          status: app.status,
          url: app.url,
          created: app.createdAt,
          updated: app.updatedAt,
          idCorrected: app._idCorrected,
          tables: [] as any[]
        };

        if (validated.includeTables) {
          try {
            const tables = await client.getTables(app._id);
            appInfo.tables = tables.map(table => ({
              id: table._id,
              name: table.name,
              type: table.type,
              fieldCount: Object.keys(table.schema).length,
              fields: Object.keys(table.schema)
            }));
          } catch (error) {
            logger.warn(`Could not get tables for app ${app.name}`, error);
            appInfo.tables = [{ error: 'Could not load tables' }];
          }
        }

        return appInfo;
      }));
      
      return {
        success: true,
        data: {
          totalApps: apps.length,
          apps: appsWithDetails
        },
        message: `Discovered ${apps.length} applications with full structure`,
      };
    },
  },

  {
    name: 'list_applications',
    description: 'List all Budibase applications with their status and details',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute(args: unknown, client: BudibaseClient) {
      logger.info('Listing applications');
      
      const apps = await client.getApplications();
      
      return {
        success: true,
        data: {
          applications: apps.map(app => ({
            id: app._id,
            name: app.name,
            url: app.url,
            status: app.status,
            createdAt: app.createdAt,
            updatedAt: app.updatedAt,
            // Include debugging info for ID resolution
            _metadataId: app._metadataId,
            _idCorrected: app._idCorrected
          })),
        },
        message: `Retrieved ${apps.length} applications`,
      };
    },
  },
  {
    name: 'get_application',
    description: 'Get detailed information about a specific Budibase application',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Budibase application ID' },
      },
      required: ['appId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(z.object({ appId: AppIdSchema }), args);
      logger.info('Getting application details', { appId: validated.appId });
      
      const app = await client.getApplication(validated.appId);
      
      return {
        success: true,
        data: { application: app },
        message: `Retrieved application details for ${app.name}`,
      };
    },
  },

  {
    name: 'create_application',
    description: 'Create a new Budibase application',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Application name' },
        url: { type: 'string', description: 'Application URL (optional)' },
        template: { type: 'string', description: 'Template to use (optional)' },
      },
      required: ['name'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(CreateAppSchema, args);
      logger.info('Creating application', { name: validated.name });
      
      const app = await client.createApplication(validated);
      
      return {
        success: true,
        data: { application: app },
        message: `Successfully created application: ${app.name} (ID: ${app._id})`,
      };
    },
  },

  {
    name: 'publish_application',
    description: 'Publish a Budibase application to production',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Budibase application ID to publish' },
      },
      required: ['appId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(PublishAppSchema, args);
      logger.info('Publishing application', { appId: validated.appId });
      
      await client.publishApplication(validated.appId);
      
      return {
        success: true,
        message: `Successfully published application ${validated.appId}`,
      };
    },
  },

  {
    name: 'update_application',
    description: 'Update an existing Budibase application',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application ID to update' },
        name: { type: 'string', description: 'New application name (optional)' },
        url: { type: 'string', description: 'New application URL (optional)' },
      },
      required: ['appId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(UpdateAppSchema, args);
      logger.info('Updating application', { appId: validated.appId });
      
      const { appId, ...updateData } = validated;
      const app = await client.updateApplication(appId, updateData);
      
      return {
        success: true,
        data: { application: app },
        message: `Successfully updated application: ${app.name}`,
      };
    },
  },

  {
    name: 'delete_application',
    description: 'Delete a Budibase application',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application ID to delete' },
      },
      required: ['appId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(PublishAppSchema, args);
      logger.info('Deleting application', { appId: validated.appId });
      
      await client.deleteApplication(validated.appId);
      
      return {
        success: true,
        message: `Successfully deleted application ${validated.appId}`,
      };
    },
  },

  {
    name: 'unpublish_application',
    description: 'Unpublish a Budibase application from production',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application ID to unpublish' },
      },
      required: ['appId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(PublishAppSchema, args);
      logger.info('Unpublishing application', { appId: validated.appId });
      
      await client.unpublishApplication(validated.appId);
      
      return {
        success: true,
        message: `Successfully unpublished application ${validated.appId}`,
      };
    },
  },

];