import type { BudibaseClient } from '../clients/budibase';
import { config } from '../config';
import type { MCPResource } from '../types/mcp';

export const resources: MCPResource[] = [
  {
    uri: 'budibase://system/status',
    name: 'System Status',
    description: 'Current system status and health information',
    mimeType: 'application/json',
    read(client: BudibaseClient) {
      const cacheStats = client.getCacheStats();
      return Promise.resolve({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        cache: cacheStats,
        version: '1.0.0',
      });
    },
  },

  {
    uri: 'budibase://system/capabilities',
    name: 'System Capabilities',
    description: 'Operational limits, batch constraints, and configuration for planning tool usage',
    mimeType: 'application/json',
    read(_client: BudibaseClient) {
      return Promise.resolve({
        batch: {
          maxSize: 50,
          defaultSize: 10,
          defaultConcurrency: 3,
        },
        cache: {
          ttlSeconds: config.server.cacheTtl,
          cachedEntities: ['applications', 'tables', 'users'],
          notCached: ['records', 'queries'],
        },
        requests: {
          timeoutMs: config.server.requestTimeout,
          maxRetries: config.server.maxRetries,
          retryOn: ['network errors', '429 rate limit', '5xx server errors'],
        },
        query: {
          maxLimit: 1000,
          defaultLimit: 50,
          filterTypes: ['string', 'fuzzy', 'range', 'equal', 'notEqual', 'empty', 'notEmpty'],
        },
        idResolution: {
          supported: ['applications', 'tables'],
          formats: ['name (case-insensitive)', 'ID', 'metadata ID'],
        },
      });
    },
  },

  {
    uri: 'budibase://applications/summary',
    name: 'Applications Summary',
    description: 'Summary of all applications and their current status',
    mimeType: 'application/json',
    async read(client: BudibaseClient) {
      const apps = await client.getApplications();
      return {
        totalApplications: apps.length,
        published: apps.filter((app) => app.status === 'published').length,
        development: apps.filter((app) => app.status === 'development').length,
        applications: apps.map((app) => ({
          id: app._id,
          name: app.name,
          status: app.status,
          lastUpdated: app.updatedAt,
        })),
      };
    },
  },

  {
    uri: 'budibase://users/summary',
    name: 'Users Summary',
    description: 'Summary of all users and their status',
    mimeType: 'application/json',
    async read(client: BudibaseClient) {
      const users = await client.getUsers();
      return {
        totalUsers: users.length,
        activeUsers: users.filter((user) => user.status === 'active').length,
        inactiveUsers: users.filter((user) => user.status === 'inactive').length,
        users: users.map((user) => ({
          id: user._id,
          email: user.email,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
          status: user.status,
        })),
      };
    },
  },
];
