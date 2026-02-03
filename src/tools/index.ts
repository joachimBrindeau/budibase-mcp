import type { MCPTool } from '../types/mcp';
import { applicationTools } from './applications';
import { batchOperationTools } from './batchOperations';
import { databaseTools } from './database';
import { dataTransformTools } from './dataTransform';
import { queryTools } from './queries';
import { userTools } from './users';

export const tools: MCPTool[] = [
  ...databaseTools,
  ...applicationTools,
  ...userTools,
  ...queryTools,
  ...batchOperationTools,
  ...dataTransformTools,
];
