import { z } from 'zod';
import type { BudibaseClient } from '../clients/budibase';
import type { MCPTool } from '../types/mcp';
import { BudibaseError } from '../utils/errors';
import { logger } from '../utils/logger';
import { EmailSchema, validateSchema } from '../utils/validation';

const CreateUserSchema = z.object({
  email: EmailSchema,
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  roles: z.record(z.string()).optional(),
});

const UpdateUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  email: EmailSchema.optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  roles: z.record(z.string()).optional(),
});

const GetUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export const userTools: MCPTool[] = [
  {
    name: 'list_users',
    description:
      'List all users with email, name, status, and roles. Related: get_user (single user details), create_user.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute(_args: unknown, client: BudibaseClient) {
      logger.info('Listing users');
      const users = await client.getUsers();
      return {
        success: true,
        data: {
          users: users.map((user) => ({
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            status: user.status,
            roles: user.roles,
          })),
        },
        message: `Retrieved ${users.length} users`,
      };
    },
  },
  {
    name: 'get_user',
    description: 'Get details of a specific user by ID',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID to retrieve' },
      },
      required: ['userId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(GetUserSchema, args);
      logger.info('Getting user', { userId: validated.userId });

      // Since there's no direct get user endpoint, use search and filter
      const users = await client.getUsers();
      const user = users.find((u) => u._id === validated.userId);

      if (!user) {
        throw new BudibaseError(`User not found: ${validated.userId}`, 404);
      }

      return {
        success: true,
        data: { user },
        message: `Retrieved user details for ${user.email}`,
      };
    },
  },
  {
    name: 'create_user',
    description:
      'Create a new user. Password must be 8+ characters. Roles map app IDs to role names. Related: list_users, update_user.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'User email address' },
        firstName: { type: 'string', description: 'User first name (optional)' },
        lastName: { type: 'string', description: 'User last name (optional)' },
        password: { type: 'string', description: 'User password (minimum 8 characters)' },
        roles: { type: 'object', description: 'User roles mapping (optional)' },
      },
      required: ['email', 'password'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(CreateUserSchema, args);
      logger.info('Creating user', { email: validated.email });

      const user = await client.createUser(validated);

      return {
        success: true,
        data: { user },
        message: `Successfully created user: ${user.email} (ID: ${user._id})`,
      };
    },
  },

  {
    name: 'update_user',
    description:
      'Update user details. Only include fields to change. Use list_users to find user IDs. Related: get_user, delete_user.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID to update' },
        email: { type: 'string', description: 'New email address (optional)' },
        firstName: { type: 'string', description: 'New first name (optional)' },
        lastName: { type: 'string', description: 'New last name (optional)' },
        status: { type: 'string', enum: ['active', 'inactive'], description: 'User status (optional)' },
        roles: { type: 'object', description: 'New roles mapping (optional)' },
      },
      required: ['userId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(UpdateUserSchema, args);
      logger.info('Updating user', { userId: validated.userId });

      const { userId, ...updateData } = validated;

      // Get current user data first since PUT requires complete object
      const users = await client.getUsers();
      const currentUser = users.find((u) => u._id === userId);

      if (!currentUser) {
        throw new BudibaseError(`User not found: ${userId}`, 404);
      }

      // Merge current data with updates
      const mergedData = {
        email: updateData.email || currentUser.email,
        firstName: updateData.firstName || currentUser.firstName,
        lastName: updateData.lastName || currentUser.lastName,
        status: updateData.status || currentUser.status,
        roles: updateData.roles || currentUser.roles || {},
      };

      const user = await client.updateUser(userId, mergedData);

      return {
        success: true,
        data: { user },
        message: `Successfully updated user ${userId}`,
      };
    },
  },

  {
    name: 'delete_user',
    description: 'Delete a user permanently. Use list_users to find user IDs. Related: update_user.',
    inputSchema: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID to delete' },
      },
      required: ['userId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(GetUserSchema, args);
      logger.info('Deleting user', { userId: validated.userId });

      await client.deleteUser(validated.userId);

      return {
        success: true,
        message: `Successfully deleted user ${validated.userId}`,
      };
    },
  },
];
