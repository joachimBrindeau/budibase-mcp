import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  budibase: z.object({
    url: z.string().url(),
    apiKey: z.string().min(1),
    appId: z.string().optional(),
  }),
  server: z.object({
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    cacheTtl: z.number().default(300),
    maxRetries: z.number().default(3),
    requestTimeout: z.number().default(30000),
  }),
});

export const config = configSchema.parse({
  budibase: {
    url: process.env.BUDIBASE_URL,
    apiKey: process.env.BUDIBASE_API_KEY,
    appId: process.env.BUDIBASE_APP_ID,
  },
  server: {
    logLevel: process.env.LOG_LEVEL || 'info',
    cacheTtl: parseInt(process.env.CACHE_TTL || '300'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
  },
});