import { MCPResource } from '../types/mcp';
import { BudibaseClient } from '../clients/budibase';

export const resources: MCPResource[] = [
  {
    uri: 'budibase://system/status',
    name: 'System Status',
    description: 'Current system status and health information',
    mimeType: 'application/json',
    async read(client: BudibaseClient) {
      const cacheStats = client.getCacheStats();
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        cache: cacheStats,
        version: '1.0.0',
      };
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
        published: apps.filter(app => app.status === 'published').length,
        development: apps.filter(app => app.status === 'development').length,
        applications: apps.map(app => ({
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
        activeUsers: users.filter(user => user.status === 'active').length,
        inactiveUsers: users.filter(user => user.status === 'inactive').length,
        users: users.map(user => ({
          id: user._id,
          email: user.email,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
          status: user.status,
        })),
      };
    },
  },
];