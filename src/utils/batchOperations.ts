import pMap from 'p-map';
import type { BudibaseClient } from '../clients/budibase';
import type { BudibaseRecord } from '../types/budibase';
import { BudibaseError } from './errors';
import { logger } from './logger';

export interface BatchResult<T = unknown> {
  success: boolean;
  partialSuccess: boolean;
  totalRequested: number;
  totalProcessed: number;
  totalSuccessful: number;
  totalFailed: number;
  results: T[];
  errors: Array<{ index: number; error: string; data?: unknown }>;
  summary: string;
}

interface BatchOptions {
  batchSize?: number;
  continueOnError?: boolean;
  concurrency?: number;
}

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 50;
const DEFAULT_CONCURRENCY = 3;

async function processBatch<TInput, TOutput>(
  items: TInput[],
  processor: (item: TInput, index: number) => Promise<TOutput>,
  options: BatchOptions = {},
): Promise<BatchResult<TOutput>> {
  const { continueOnError = true, concurrency = DEFAULT_CONCURRENCY } = options;

  const result: BatchResult<TOutput> = {
    success: false,
    partialSuccess: false,
    totalRequested: items.length,
    totalProcessed: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    results: [],
    errors: [],
    summary: '',
  };

  let shouldStop = false;

  await pMap(
    items,
    async (item, index) => {
      if (shouldStop) return;

      try {
        const output = await processor(item, index);
        result.results.push(output);
        result.totalSuccessful++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push({ index, error: errorMessage, data: item });
        result.totalFailed++;

        if (!continueOnError) {
          shouldStop = true;
        }
      }
      result.totalProcessed++;
    },
    { concurrency, stopOnError: false },
  );

  result.success = result.totalFailed === 0;
  result.partialSuccess = result.totalFailed > 0 && result.totalSuccessful > 0;
  result.summary = `Processed ${result.totalProcessed}/${result.totalRequested}. ${result.totalSuccessful} successful, ${result.totalFailed} failed.`;

  return result;
}

export class BatchOperationManager {
  constructor(private client: BudibaseClient) {}

  batchCreate(
    appId: string,
    tableId: string,
    records: Record<string, unknown>[],
    options: BatchOptions = {},
  ): Promise<BatchResult<BudibaseRecord>> {
    const batchSize = Math.min(options.batchSize || DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);
    logger.info('Starting batch create', { appId, tableId, count: records.length, batchSize });

    return processBatch(records, async (record) => this.client.createRecord(appId, tableId, record), {
      ...options,
      concurrency: batchSize,
    });
  }

  batchUpdate(
    appId: string,
    tableId: string,
    records: Array<{ id: string; data: Record<string, unknown> }>,
    options: BatchOptions = {},
  ): Promise<BatchResult<BudibaseRecord>> {
    const batchSize = Math.min(options.batchSize || DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);
    logger.info('Starting batch update', { appId, tableId, count: records.length, batchSize });

    return processBatch(records, async ({ id, data }) => this.client.updateRecord(appId, tableId, id, data), {
      ...options,
      concurrency: batchSize,
    });
  }

  batchDelete(
    appId: string,
    tableId: string,
    recordIds: string[],
    options: BatchOptions = {},
  ): Promise<BatchResult<string>> {
    const batchSize = Math.min(options.batchSize || DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);
    logger.info('Starting batch delete', { appId, tableId, count: recordIds.length, batchSize });

    return processBatch(
      recordIds,
      async (recordId) => {
        await this.client.deleteRecord(appId, tableId, recordId);
        return recordId;
      },
      { ...options, concurrency: batchSize },
    );
  }

  batchUpsert(
    appId: string,
    tableId: string,
    records: Record<string, unknown>[],
    options: BatchOptions = {},
  ): Promise<BatchResult<BudibaseRecord>> {
    logger.info('Starting batch upsert', { appId, tableId, count: records.length });

    return processBatch(
      records,
      async (record) => {
        if (record._id) {
          try {
            return await this.client.updateRecord(appId, tableId, record._id as string, record);
          } catch (error) {
            if (error instanceof BudibaseError && error.statusCode === 404) {
              return await this.client.createRecord(appId, tableId, record);
            }
            throw error;
          }
        }
        return await this.client.createRecord(appId, tableId, record);
      },
      options,
    );
  }
}
