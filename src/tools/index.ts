import { MCPTool } from '../types/mcp';
import { databaseTools } from './database';
import { applicationTools } from './applications';
import { userTools } from './users';
import { queryTools } from './queries';
import { queryBuilderTools } from './queryBuilder';
import { batchOperationTools } from './batchOperations';
import { dataTransformTools } from './dataTransform';

export const tools: MCPTool[] = [
  ...databaseTools,
  ...applicationTools,
  ...userTools,
  ...queryTools,
  ...queryBuilderTools,
  ...batchOperationTools,
  ...dataTransformTools,
];