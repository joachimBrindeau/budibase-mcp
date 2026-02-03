#!/usr/bin/env node

import { config } from './config';
import { BudibaseMCPServer } from './server';
import { logger } from './utils/logger';

async function main() {
  try {
    logger.info('Starting Budibase MCP Server...', {
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      budibaseUrl: config.budibase.url
    });

    const server = new BudibaseMCPServer();
    await server.start();

    logger.info('Budibase MCP Server started successfully');

    // Graceful shutdown handling
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();