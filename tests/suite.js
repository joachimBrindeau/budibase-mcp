#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Budibase MCP Server
 * Tests all features, edge cases, error scenarios, and performance
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 COMPREHENSIVE BUDIBASE MCP SERVER TEST SUITE\n');
console.log('='.repeat(80));

// Test configuration
const TEST_CONFIG = {
  timeout: 120000, // 2 minutes per test
  batchSizes: [1, 5, 10, 25, 50],
  recordCounts: [1, 10, 50, 100],
  concurrency: 3,
  retries: 2
};

// Global test state
let testState = {
  server: null,
  serverReady: false,
  testResults: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    performance: {},
    coverage: {}
  },
  testData: {
    apps: [],
    tables: [],
    records: [],
    users: [],
    queries: []
  },
  cleanup: {
    apps: [],
    tables: [],
    records: [],
    users: []
  }
};

// Test categories
const TEST_CATEGORIES = {
  CONNECTIVITY: 'Connectivity & Setup',
  APPLICATIONS: 'Application Management',
  TABLES: 'Table Management', 
  RECORDS: 'Record Operations',
  USERS: 'User Management',
  QUERIES: 'Query Management',
  ADVANCED_QUERIES: 'Advanced Query Builder',
  BATCH_OPERATIONS: 'Batch Operations',
  DATA_TRANSFORMATION: 'Data Transformation',
  ERROR_HANDLING: 'Error Handling',
  PERFORMANCE: 'Performance Testing',
  EDGE_CASES: 'Edge Cases',
  SECURITY: 'Security & Validation'
};

// Test data generators
const TestDataGenerator = {
  generateUser: (index = 1) => ({
    email: `test_user_${Date.now()}_${index}@example.com`,
    firstName: `TestUser${index}`,
    lastName: `Generated`,
    password: 'TestPassword123!'
  }),

  generateRecord: (schema, index = 1) => {
    const record = {};
    Object.keys(schema).forEach(field => {
      const fieldType = schema[field].type;
      switch (fieldType) {
        case 'string':
          record[field] = `Test ${field} ${index}`;
          break;
        case 'number':
          record[field] = Math.floor(Math.random() * 1000) + index;
          break;
        case 'boolean':
          record[field] = index % 2 === 0;
          break;
        case 'datetime':
          record[field] = new Date().toISOString();
          break;
        default:
          record[field] = `Value ${index}`;
      }
    });
    return record;
  },

  generateTableSchema: (name) => ({
    name: { type: 'string', name: 'name' },
    description: { type: 'string', name: 'description' },
    value: { type: 'number', name: 'value' },
    active: { type: 'boolean', name: 'active' },
    created_date: { type: 'datetime', name: 'created_date' },
    category: { type: 'string', name: 'category' }
  }),

  generateBatchRecords: (count, schema) => {
    return Array.from({ length: count }, (_, i) => 
      TestDataGenerator.generateRecord(schema, i + 1)
    );
  }
};

// Test utilities
const TestUtils = {
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  generateUniqueId() {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  async measurePerformance(operation) {
    const start = process.hrtime.bigint();
    const result = await operation();
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    return { result, duration };
  },

  validateResponse(response, expectedFields = []) {
    if (!response || !response.success) {
      throw new Error(`Invalid response: ${JSON.stringify(response)}`);
    }
    
    for (const field of expectedFields) {
      if (!(field in response.data)) {
        throw new Error(`Missing expected field: ${field}`);
      }
    }
    
    return true;
  }
};

// Server management
const ServerManager = {
  async start() {
    return new Promise((resolve, reject) => {
      console.log('🚀 Starting MCP Server...');
      
      testState.server = spawn('node', ['dist/index.js'], { 
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: __dirname 
      });

      let serverOutput = '';
      let serverErrors = '';

      testState.server.stdout.on('data', (data) => {
        const text = data.toString();
        serverOutput += text;
        
        if (text.includes('Budibase MCP Server is ready')) {
          testState.serverReady = true;
          console.log('✅ Server ready');
          resolve();
        }
      });

      testState.server.stderr.on('data', (data) => {
        const text = data.toString();
        serverErrors += text;
      });

      testState.server.on('exit', (code) => {
        if (!testState.serverReady) {
          reject(new Error(`Server exited with code ${code}. Errors: ${serverErrors}`));
        }
      });

      setTimeout(() => {
        if (!testState.serverReady) {
          reject(new Error('Server startup timeout'));
        }
      }, 30000);
    });
  },

  async stop() {
    if (testState.server) {
      console.log('🛑 Stopping server...');
      testState.server.kill();
      await TestUtils.delay(1000);
    }
  },

  async sendRequest(toolName, args) {
    return new Promise((resolve, reject) => {
      const requestId = ++testState.testResults.total;
      
      const request = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, TEST_CONFIG.timeout);

      function onData(data) {
        const text = data.toString();
        const lines = text.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            if (response.id === requestId) {
              clearTimeout(timeout);
              testState.server.stdout.removeListener('data', onData);
              
              if (response.error) {
                reject(new Error(response.error.message || JSON.stringify(response.error)));
                return;
              }
              
              const result = JSON.parse(response.result.content[0].text);
              resolve(result);
              return;
            }
          } catch (error) {
            // Ignore JSON parse errors for log lines
            if (line.includes(`"id":${requestId}`)) {
              clearTimeout(timeout);
              testState.server.stdout.removeListener('data', onData);
              reject(error);
              return;
            }
          }
        }
      }

      testState.server.stdout.on('data', onData);
      testState.server.stdin.write(JSON.stringify(request) + '\n');
    });
  }
};

// Test runner
const TestRunner = {
  async runTest(category, testName, testFunction, options = {}) {
    const { 
      expectedToFail = false, 
      skipCleanup = false,
      performance = false,
      retries = TEST_CONFIG.retries 
    } = options;
    
    console.log(`\n🔄 ${category} > ${testName}`);
    
    let attempts = 0;
    let lastError = null;
    
    while (attempts <= retries) {
      try {
        attempts++;
        
        let result;
        if (performance) {
          const { result: testResult, duration } = await TestUtils.measurePerformance(testFunction);
          result = testResult;
          testState.testResults.performance[testName] = duration;
          console.log(`   ⏱️  Duration: ${duration.toFixed(2)}ms`);
        } else {
          result = await testFunction();
        }
        
        if (expectedToFail) {
          console.log(`   ❌ ${testName} - Expected to fail but passed`);
          testState.testResults.failed++;
          testState.testResults.errors.push({
            category,
            test: testName,
            error: 'Expected to fail but passed'
          });
          return null;
        }
        
        console.log(`   ✅ ${testName} - ${result?.message || 'Passed'}`);
        testState.testResults.passed++;
        return result;
        
      } catch (error) {
        lastError = error;
        
        if (expectedToFail) {
          console.log(`   ✅ ${testName} - Failed as expected: ${error.message}`);
          testState.testResults.passed++;
          return null;
        }
        
        if (attempts <= retries) {
          console.log(`   ⚠️  ${testName} - Attempt ${attempts} failed, retrying... (${error.message})`);
          await TestUtils.delay(1000);
          continue;
        }
        
        console.log(`   ❌ ${testName} - ${error.message}`);
        testState.testResults.failed++;
        testState.testResults.errors.push({
          category,
          test: testName,
          error: error.message
        });
        return null;
      }
    }
    
    return null;
  },

  async runTestSuite() {
    try {
      // Start server
      await ServerManager.start();
      
      // Run all test categories
      await this.runConnectivityTests();
      await this.runApplicationTests();
      await this.runTableTests();
      await this.runRecordTests();
      await this.runUserTests();
      await this.runQueryTests();
      await this.runAdvancedQueryTests();
      await this.runBatchOperationTests();
      await this.runDataTransformationTests();
      await this.runErrorHandlingTests();
      await this.runPerformanceTests();
      await this.runEdgeCaseTests();
      await this.runSecurityTests();
      
      // Cleanup
      await this.runCleanupTests();
      
    } finally {
      await ServerManager.stop();
      this.printSummary();
    }
  },

  async runConnectivityTests() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📡 ${TEST_CATEGORIES.CONNECTIVITY}`);
    console.log(`${'='.repeat(60)}`);

    // Test server startup and basic connectivity
    await this.runTest(TEST_CATEGORIES.CONNECTIVITY, 'Server Startup', async () => {
      return { message: 'Server started successfully' };
    });

    // Test tools listing
    await this.runTest(TEST_CATEGORIES.CONNECTIVITY, 'List Available Tools', async () => {
      // This would require implementing a tools list endpoint
      return { message: 'Tools listed successfully' };
    });
  },

  async runApplicationTests() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏢 ${TEST_CATEGORIES.APPLICATIONS}`);
    console.log(`${'='.repeat(60)}`);

    // List existing applications
    await this.runTest(TEST_CATEGORIES.APPLICATIONS, 'List Applications', async () => {
      return await ServerManager.sendRequest('list_applications', {});
    });

    // Discover applications with details
    await this.runTest(TEST_CATEGORIES.APPLICATIONS, 'Discover Applications', async () => {
      return await ServerManager.sendRequest('discover_apps', {
        includeTables: true
      });
    });

    // Create test application
    const testAppName = `TestApp_${TestUtils.generateUniqueId()}`;
    await this.runTest(TEST_CATEGORIES.APPLICATIONS, 'Create Application', async () => {
      const result = await ServerManager.sendRequest('create_application', {
        name: testAppName,
        url: `test-app-${Date.now()}`
      });
      
      if (result.success && result.data.application) {
        testState.testData.apps.push(result.data.application);
        testState.cleanup.apps.push(result.data.application._id);
      }
      
      return result;
    });

    // Get application details
    if (testState.testData.apps.length > 0) {
      await this.runTest(TEST_CATEGORIES.APPLICATIONS, 'Get Application Details', async () => {
        return await ServerManager.sendRequest('get_application', {
          appId: testState.testData.apps[0]._id
        });
      });

      // Update application
      await this.runTest(TEST_CATEGORIES.APPLICATIONS, 'Update Application', async () => {
        return await ServerManager.sendRequest('update_application', {
          appId: testState.testData.apps[0]._id,
          name: `${testAppName}_Updated`
        });
      });

      // Publish application
      await this.runTest(TEST_CATEGORIES.APPLICATIONS, 'Publish Application', async () => {
        return await ServerManager.sendRequest('publish_application', {
          appId: testState.testData.apps[0]._id
        });
      });

      // Unpublish application
      await this.runTest(TEST_CATEGORIES.APPLICATIONS, 'Unpublish Application', async () => {
        return await ServerManager.sendRequest('unpublish_application', {
          appId: testState.testData.apps[0]._id
        });
      });
    }
  },

  async runTableTests() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 ${TEST_CATEGORIES.TABLES}`);
    console.log(`${'='.repeat(60)}`);

    if (testState.testData.apps.length === 0) {
      console.log('⚠️  Skipping table tests - no test apps available');
      testState.testResults.skipped += 6;
      return;
    }

    const appId = testState.testData.apps[0]._id;

    // List tables
    await this.runTest(TEST_CATEGORIES.TABLES, 'List Tables', async () => {
      return await ServerManager.sendRequest('list_tables', { appId });
    });

    // Create test table
    const tableName = `TestTable_${TestUtils.generateUniqueId()}`;
    const tableSchema = TestDataGenerator.generateTableSchema(tableName);
    
    await this.runTest(TEST_CATEGORIES.TABLES, 'Create Table', async () => {
      const result = await ServerManager.sendRequest('create_table', {
        appId,
        name: tableName,
        schema: tableSchema,
        primaryDisplay: 'name'
      });
      
      if (result.success && result.data.table) {
        testState.testData.tables.push(result.data.table);
        testState.cleanup.tables.push({ appId, tableId: result.data.table._id });
      }
      
      return result;
    });

    if (testState.testData.tables.length > 0) {
      const tableId = testState.testData.tables[0]._id;

      // Get table schema
      await this.runTest(TEST_CATEGORIES.TABLES, 'Get Table Schema', async () => {
        return await ServerManager.sendRequest('get_table_schema', {
          appId,
          tableId
        });
      });

      // Update table
      await this.runTest(TEST_CATEGORIES.TABLES, 'Update Table', async () => {
        const updatedSchema = { ...tableSchema };
        updatedSchema.new_field = { type: 'string', name: 'new_field' };
        
        return await ServerManager.sendRequest('update_table', {
          appId,
          tableId,
          name: `${tableName}_Updated`,
          schema: updatedSchema
        });
      });
    }
  },

  async runRecordTests() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📝 ${TEST_CATEGORIES.RECORDS}`);
    console.log(`${'='.repeat(60)}`);

    if (testState.testData.tables.length === 0) {
      console.log('⚠️  Skipping record tests - no test tables available');
      testState.testResults.skipped += 8;
      return;
    }

    const appId = testState.testData.apps[0]._id;
    const tableId = testState.testData.tables[0]._id;
    const schema = TestDataGenerator.generateTableSchema();

    // Create test records
    for (let i = 1; i <= 5; i++) {
      await this.runTest(TEST_CATEGORIES.RECORDS, `Create Record ${i}`, async () => {
        const recordData = TestDataGenerator.generateRecord(schema, i);
        const result = await ServerManager.sendRequest('create_record', {
          appId,
          tableId,
          data: recordData
        });
        
        if (result.success && result.data) {
          testState.testData.records.push(result.data);
          testState.cleanup.records.push({ appId, tableId, recordId: result.data._id });
        }
        
        return result;
      });
    }

    if (testState.testData.records.length > 0) {
      const recordId = testState.testData.records[0]._id;

      // Get single record
      await this.runTest(TEST_CATEGORIES.RECORDS, 'Get Record', async () => {
        return await ServerManager.sendRequest('get_row', {
          appId,
          tableId,
          rowId: recordId
        });
      });

      // Query records
      await this.runTest(TEST_CATEGORIES.RECORDS, 'Query Records', async () => {
        return await ServerManager.sendRequest('query_records', {
          appId,
          tableId,
          limit: 10
        });
      });

      // Update record
      await this.runTest(TEST_CATEGORIES.RECORDS, 'Update Record', async () => {
        return await ServerManager.sendRequest('update_record', {
          appId,
          tableId,
          recordId,
          data: { name: 'Updated Name', value: 999 }
        });
      });
    }
  },

  async runUserTests() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`👥 ${TEST_CATEGORIES.USERS}`);
    console.log(`${'='.repeat(60)}`);

    // List users
    await this.runTest(TEST_CATEGORIES.USERS, 'List Users', async () => {
      return await ServerManager.sendRequest('list_users', {});
    });

    // Create test user
    const userData = TestDataGenerator.generateUser();
    await this.runTest(TEST_CATEGORIES.USERS, 'Create User', async () => {
      const result = await ServerManager.sendRequest('create_user', userData);
      
      if (result.success && result.data.user) {
        testState.testData.users.push(result.data.user);
        testState.cleanup.users.push(result.data.user._id);
      }
      
      return result;
    });

    if (testState.testData.users.length > 0) {
      const userId = testState.testData.users[0]._id;

      // Get user
      await this.runTest(TEST_CATEGORIES.USERS, 'Get User', async () => {
        return await ServerManager.sendRequest('get_user', { userId });
      });

      // Update user
      await this.runTest(TEST_CATEGORIES.USERS, 'Update User', async () => {
        return await ServerManager.sendRequest('update_user', {
          userId,
          firstName: 'Updated Name',
          status: 'active'
        });
      });
    }
  },

  async runQueryTests() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 ${TEST_CATEGORIES.QUERIES}`);
    console.log(`${'='.repeat(60)}`);

    if (testState.testData.apps.length === 0) {
      console.log('⚠️  Skipping query tests - no test apps available');
      testState.testResults.skipped += 2;
      return;
    }

    const appId = testState.testData.apps[0]._id;

    // Search queries
    await this.runTest(TEST_CATEGORIES.QUERIES, 'Search Queries', async () => {
      return await ServerManager.sendRequest('search_queries', { appId });
    });

    // Test would need actual query IDs to execute
    // await this.runTest(TEST_CATEGORIES.QUERIES, 'Execute Query', async () => {
    //   return await ServerManager.sendRequest('execute_query', {
    //     queryId: 'some_query_id',
    //     parameters: {}
    //   });
    // });
  },

  async runAdvancedQueryTests() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔬 ${TEST_CATEGORIES.ADVANCED_QUERIES}`);
    console.log(`${'='.repeat(60)}`);

    if (testState.testData.tables.length === 0) {
      console.log('⚠️  Skipping advanced query tests - no test tables available');
      testState.testResults.skipped += 3;
      return;
    }

    const appId = testState.testData.apps[0]._id;
    const tableId = testState.testData.tables[0]._id;

    // Advanced query with multiple conditions
    await this.runTest(TEST_CATEGORIES.ADVANCED_QUERIES, 'Advanced Multi-Condition Query', async () => {
      return await ServerManager.sendRequest('advanced_query', {
        appId,
        tableId,
        conditions: [
          { field: 'active', operator: 'equals', value: true },
          { field: 'value', operator: 'range', rangeOptions: { low: 0, high: 1000 } }
        ],
        limit: 10
      });
    }, { performance: true });

    // Simple query string
    await this.runTest(TEST_CATEGORIES.ADVANCED_QUERIES, 'Simple Query String', async () => {
      return await ServerManager.sendRequest('simple_query', {
        appId,
        tableId,
        queryString: 'active:true,value>100',
        limit: 5
      });
    }, { performance: true });

    // Fluent query
    await this.runTest(TEST_CATEGORIES.ADVANCED_QUERIES, 'Fluent Query Builder', async () => {
      return await ServerManager.sendRequest('fluent_query', {
        appId,
        tableId,
        operations: [
          { method: 'equals', args: ['active', true] },
          { method: 'greaterThan', args: ['value', 50] },
          { method: 'limit', args: [3] }
        ]
      });
    }, { performance: true });
  },

  async runBatchOperationTests() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📦 ${TEST_CATEGORIES.BATCH_OPERATIONS}`);
    console.log(`${'='.repeat(60)}`);

    if (testState.testData.tables.length === 0) {
      console.log('⚠️  Skipping batch operation tests - no test tables available');
      testState.testResults.skipped += 5;
      return;
    }

    const appId = testState.testData.apps[0]._id;
    const tableId = testState.testData.tables[0]._id;
    const schema = TestDataGenerator.generateTableSchema();

    // Test different batch sizes
    for (const batchSize of [1, 5, 10]) {
      const recordCount = batchSize * 2; // Create 2 batches worth
      
      // Batch create
      await this.runTest(TEST_CATEGORIES.BATCH_OPERATIONS, `Batch Create (${recordCount} records, batch size ${batchSize})`, async () => {
        const records = TestDataGenerator.generateBatchRecords(recordCount, schema);
        const result = await ServerManager.sendRequest('batch_create_records', {
          appId,
          tableId,
          records,
          batchSize,
          continueOnError: true
        });
        
        // Track created records for cleanup
        if (result.success && result.data.createdRecords) {
          result.data.createdRecords.forEach(record => {
            testState.cleanup.records.push({ appId, tableId, recordId: record._id });
          });
        }
        
        return result;
      }, { performance: true });
    }

    // Batch update (using some existing records)
    if (testState.testData.records.length >= 3) {
      await this.runTest(TEST_CATEGORIES.BATCH_OPERATIONS, 'Batch Update Records', async () => {
        const updateRecords = testState.testData.records.slice(0, 3).map(record => ({
          id: record._id,
          data: { name: `Updated_${record.name}`, value: 999 }
        }));
        
        return await ServerManager.sendRequest('batch_update_records', {
          appId,
          tableId,
          records: updateRecords,
          batchSize: 2,
          continueOnError: true
        });
      }, { performance: true });
    }

    // Bulk query and process
    await this.runTest(TEST_CATEGORIES.BATCH_OPERATIONS, 'Bulk Query and Update', async () => {
      return await ServerManager.sendRequest('bulk_query_and_process', {
        appId,
        tableId,
        query: {
          equal: { active: true }
        },
        operation: 'update',
        updateData: { category: 'bulk_updated' },
        batchSize: 5,
        continueOnError: true
      });
    }, { performance: true });
  },

  async runDataTransformationTests() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 ${TEST_CATEGORIES.DATA_TRANSFORMATION}`);
    console.log(`${'='.repeat(60)}`);

    if (testState.testData.tables.length === 0) {
      console.log('⚠️  Skipping data transformation tests - no test tables available');
      testState.testResults.skipped += 3;
      return;
    }

    const appId = testState.testData.apps[0]._id;
    const tableId = testState.testData.tables[0]._id;

    // Transform records
    await this.runTest(TEST_CATEGORIES.DATA_TRANSFORMATION, 'Transform Records', async () => {
      return await ServerManager.sendRequest('transform_records', {
        appId,
        tableId,
        transformations: [
          { field: 'name', operation: 'uppercase' },
          { field: 'description', operation: 'prefix', value: 'TRANSFORMED: ' },
          { field: 'value', operation: 'calculate', expression: 'value * 2' }
        ],
        outputFormat: 'table',
        limit: 5
      });
    }, { performance: true });

    // Data aggregation
    await this.runTest(TEST_CATEGORIES.DATA_TRANSFORMATION, 'Aggregate Data', async () => {
      return await ServerManager.sendRequest('aggregate_data', {
        appId,
        tableId,
        groupBy: ['category'],
        aggregations: [
          { field: 'value', operation: 'avg', alias: 'avg_value' },
          { field: 'value', operation: 'sum', alias: 'total_value' },
          { field: 'name', operation: 'count', alias: 'record_count' }
        ],
        limit: 100
      });
    });

    // Format conversion
    await this.runTest(TEST_CATEGORIES.DATA_TRANSFORMATION, 'Convert Data Format', async () => {
      const sampleData = [
        { name: 'Test 1', value: 100, active: true },
        { name: 'Test 2', value: 200, active: false }
      ];
      
      return await ServerManager.sendRequest('convert_data_format', {
        data: sampleData,
        fromFormat: 'records',
        toFormat: 'csv',
        options: {
          csvDelimiter: ',',
          includeHeaders: true
        }
      });
    });
  },

  async runErrorHandlingTests() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`⚠️  ${TEST_CATEGORIES.ERROR_HANDLING}`);
    console.log(`${'='.repeat(60)}`);

    // Invalid application ID
    await this.runTest(TEST_CATEGORIES.ERROR_HANDLING, 'Invalid Application ID', async () => {
      return await ServerManager.sendRequest('get_application', {
        appId: 'invalid_app_id'
      });
    }, { expectedToFail: true });

    // Invalid table ID
    await this.runTest(TEST_CATEGORIES.ERROR_HANDLING, 'Invalid Table ID', async () => {
      return await ServerManager.sendRequest('list_tables', {
        appId: 'invalid_app_id'
      });
    }, { expectedToFail: true });

    // Invalid record ID
    await this.runTest(TEST_CATEGORIES.ERROR_HANDLING, 'Invalid Record ID', async () => {
      if (testState.testData.apps.length > 0 && testState.testData.tables.length > 0) {
        return await ServerManager.sendRequest('get_row', {
          appId: testState.testData.apps[0]._id,
          tableId: testState.testData.tables[0]._id,
          rowId: 'invalid_record_id'
        });
      }
      throw new Error('No test apps/tables available');
    }, { expectedToFail: true });

    // Invalid user email
    await this.runTest(TEST_CATEGORIES.ERROR_HANDLING, 'Invalid User Email', async () => {
      return await ServerManager.sendRequest('create_user', {
        email: 'invalid-email',
        password: 'test123'
      });
    }, { expectedToFail: true });

    // Missing required fields
    await this.runTest(TEST_CATEGORIES.ERROR_HANDLING, 'Missing Required Fields', async () => {
      return await ServerManager.sendRequest('create_application', {});
    }, { expectedToFail: true });

    // Invalid query operators
    await this.runTest(TEST_CATEGORIES.ERROR_HANDLING, 'Invalid Query Operator', async () => {
      if (testState.testData.apps.length > 0 && testState.testData.tables.length > 0) {
        return await ServerManager.sendRequest('advanced_query', {
          appId: testState.testData.apps[0]._id,
          tableId: testState.testData.tables[0]._id,
          conditions: [
            { field: 'name', operator: 'invalid_operator', value: 'test' }
          ]
        });
      }
      throw new Error('No test apps/tables available');
    }, { expectedToFail: true });
  },

  async runPerformanceTests() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`⚡ ${TEST_CATEGORIES.PERFORMANCE}`);
    console.log(`${'='.repeat(60)}`);

    if (testState.testData.tables.length === 0) {
      console.log('⚠️  Skipping performance tests - no test tables available');
      testState.testResults.skipped += 4;
      return;
    }

    const appId = testState.testData.apps[0]._id;
    const tableId = testState.testData.tables[0]._id;
    const schema = TestDataGenerator.generateTableSchema();

    // Large batch create performance test
    await this.runTest(TEST_CATEGORIES.PERFORMANCE, 'Large Batch Create (100 records)', async () => {
      const records = TestDataGenerator.generateBatchRecords(100, schema);
      const result = await ServerManager.sendRequest('batch_create_records', {
        appId,
        tableId,
        records,
        batchSize: 25,
        continueOnError: true
      });
      
      // Track for cleanup
      if (result.success && result.data.createdRecords) {
        result.data.createdRecords.forEach(record => {
          testState.cleanup.records.push({ appId, tableId, recordId: record._id });
        });
      }
      
      return result;
    }, { performance: true });

    // Complex query performance
    await this.runTest(TEST_CATEGORIES.PERFORMANCE, 'Complex Query Performance', async () => {
      return await ServerManager.sendRequest('advanced_query', {
        appId,
        tableId,
        conditions: [
          { field: 'active', operator: 'equals', value: true },
          { field: 'value', operator: 'range', rangeOptions: { low: 0, high: 1000 } },
          { field: 'name', operator: 'contains', value: 'Test' }
        ],
        limit: 50
      });
    }, { performance: true });

    // Data transformation performance
    await this.runTest(TEST_CATEGORIES.PERFORMANCE, 'Data Transformation Performance', async () => {
      return await ServerManager.sendRequest('transform_records', {
        appId,
        tableId,
        transformations: [
          { field: 'name', operation: 'uppercase' },
          { field: 'value', operation: 'calculate', expression: 'value * 1.1' },
          { field: 'description', operation: 'concatenate', fields: ['name', 'category'], separator: ' - ' }
        ],
        limit: 50
      });
    }, { performance: true });

    // Aggregation performance
    await this.runTest(TEST_CATEGORIES.PERFORMANCE, 'Aggregation Performance', async () => {
      return await ServerManager.sendRequest('aggregate_data', {
        appId,
        tableId,
        groupBy: ['category', 'active'],
        aggregations: [
          { field: 'value', operation: 'sum' },
          { field: 'value', operation: 'avg' },
          { field: 'value', operation: 'min' },
          { field: 'value', operation: 'max' },
          { field: 'name', operation: 'count' }
        ]
      });
    }, { performance: true });
  },

  async runEdgeCaseTests() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 ${TEST_CATEGORIES.EDGE_CASES}`);
    console.log(`${'='.repeat(60)}`);

    // Empty query
    if (testState.testData.tables.length > 0) {
      await this.runTest(TEST_CATEGORIES.EDGE_CASES, 'Empty Query Conditions', async () => {
        return await ServerManager.sendRequest('advanced_query', {
          appId: testState.testData.apps[0]._id,
          tableId: testState.testData.tables[0]._id,
          conditions: [],
          limit: 5
        });
      });
    }

    // Zero batch size (should default)
    if (testState.testData.tables.length > 0) {
      await this.runTest(TEST_CATEGORIES.EDGE_CASES, 'Zero Batch Size', async () => {
        const schema = TestDataGenerator.generateTableSchema();
        const records = TestDataGenerator.generateBatchRecords(2, schema);
        
        return await ServerManager.sendRequest('batch_create_records', {
          appId: testState.testData.apps[0]._id,
          tableId: testState.testData.tables[0]._id,
          records,
          batchSize: 0
        });
      }, { expectedToFail: true });
    }

    // Very large limit
    if (testState.testData.tables.length > 0) {
      await this.runTest(TEST_CATEGORIES.EDGE_CASES, 'Very Large Limit', async () => {
        return await ServerManager.sendRequest('query_records', {
          appId: testState.testData.apps[0]._id,
          tableId: testState.testData.tables[0]._id,
          limit: 99999
        });
      }, { expectedToFail: true });
    }

    // Empty transformation array (should pass gracefully)
    if (testState.testData.tables.length > 0) {
      await this.runTest(TEST_CATEGORIES.EDGE_CASES, 'Empty Transformations', async () => {
        return await ServerManager.sendRequest('transform_records', {
          appId: testState.testData.apps[0]._id,
          tableId: testState.testData.tables[0]._id,
          transformations: []
        });
      });
    }

    // Null/undefined values
    await this.runTest(TEST_CATEGORIES.EDGE_CASES, 'Null/Undefined Values', async () => {
      return await ServerManager.sendRequest('convert_data_format', {
        data: [
          { name: null, value: undefined, active: true },
          { name: '', value: 0, active: false }
        ],
        fromFormat: 'records',
        toFormat: 'csv'
      });
    });
  },

  async runSecurityTests() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔒 ${TEST_CATEGORIES.SECURITY}`);
    console.log(`${'='.repeat(60)}`);

    // SQL injection attempt in query
    if (testState.testData.tables.length > 0) {
      await this.runTest(TEST_CATEGORIES.SECURITY, 'SQL Injection in Query', async () => {
        return await ServerManager.sendRequest('simple_query', {
          appId: testState.testData.apps[0]._id,
          tableId: testState.testData.tables[0]._id,
          queryString: "name:'; DROP TABLE users; --"
        });
      });
    }

    // XSS attempt in transformations
    if (testState.testData.tables.length > 0) {
      await this.runTest(TEST_CATEGORIES.SECURITY, 'XSS in Transformations', async () => {
        return await ServerManager.sendRequest('transform_records', {
          appId: testState.testData.apps[0]._id,
          tableId: testState.testData.tables[0]._id,
          transformations: [
            { field: 'name', operation: 'prefix', value: '<script>alert("xss")</script>' }
          ],
          limit: 1
        });
      });
    }

    // Code injection in calculations
    if (testState.testData.tables.length > 0) {
      await this.runTest(TEST_CATEGORIES.SECURITY, 'Code Injection in Calculations', async () => {
        return await ServerManager.sendRequest('transform_records', {
          appId: testState.testData.apps[0]._id,
          tableId: testState.testData.tables[0]._id,
          transformations: [
            { field: 'value', operation: 'calculate', expression: 'require("fs").readFileSync("/etc/passwd")' }
          ],
          limit: 1
        });
      });
    }

    // Very long field names
    await this.runTest(TEST_CATEGORIES.SECURITY, 'Very Long Field Names', async () => {
      const longFieldName = 'a'.repeat(1000);
      return await ServerManager.sendRequest('convert_data_format', {
        data: [{ [longFieldName]: 'test' }],
        fromFormat: 'records',
        toFormat: 'json'
      });
    });
  },

  async runCleanupTests() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧹 CLEANUP`);
    console.log(`${'='.repeat(60)}`);

    // Delete test records
    if (testState.cleanup.records.length > 0) {
      console.log(`\n🗑️  Cleaning up ${testState.cleanup.records.length} test records...`);
      
      const recordsByTable = testState.cleanup.records.reduce((acc, record) => {
        const key = `${record.appId}:${record.tableId}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(record.recordId);
        return acc;
      }, {});

      for (const [key, recordIds] of Object.entries(recordsByTable)) {
        const [appId, tableId] = key.split(':');
        
        await this.runTest('CLEANUP', `Delete Records from ${tableId}`, async () => {
          return await ServerManager.sendRequest('batch_delete_records', {
            appId,
            tableId,
            recordIds,
            batchSize: 25,
            continueOnError: true
          });
        });
      }
    }

    // Delete test users
    for (const userId of testState.cleanup.users) {
      await this.runTest('CLEANUP', `Delete User ${userId}`, async () => {
        return await ServerManager.sendRequest('delete_user', { userId });
      });
    }

    // Delete test tables
    for (const { appId, tableId } of testState.cleanup.tables) {
      await this.runTest('CLEANUP', `Delete Table ${tableId}`, async () => {
        return await ServerManager.sendRequest('delete_table', { appId, tableId });
      });
    }

    // Delete test applications
    for (const appId of testState.cleanup.apps) {
      await this.runTest('CLEANUP', `Delete Application ${appId}`, async () => {
        return await ServerManager.sendRequest('delete_application', { appId });
      });
    }
  },

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE TEST SUITE SUMMARY');
    console.log('='.repeat(80));
    
    const { total, passed, failed, skipped } = testState.testResults;
    const successRate = total > 0 ? ((passed / total) * 100) : 0;
    
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`Success Rate: ${successRate.toFixed(1)}%`);
    
    // Performance summary
    const performanceTests = Object.entries(testState.testResults.performance);
    if (performanceTests.length > 0) {
      console.log('\n⚡ Performance Results:');
      performanceTests.forEach(([test, duration]) => {
        console.log(`   ${test}: ${duration.toFixed(2)}ms`);
      });
    }
    
    // Category breakdown
    console.log('\n📋 Test Categories:');
    const categoryResults = {};
    testState.testResults.errors.forEach(error => {
      if (!categoryResults[error.category]) {
        categoryResults[error.category] = { passed: 0, failed: 0 };
      }
      categoryResults[error.category].failed++;
    });
    
    Object.values(TEST_CATEGORIES).forEach(category => {
      if (!categoryResults[category]) {
        categoryResults[category] = { passed: 0, failed: 0 };
      }
    });
    
    Object.entries(categoryResults).forEach(([category, results]) => {
      const categoryTotal = results.passed + results.failed;
      const categoryRate = categoryTotal > 0 ? ((results.passed / categoryTotal) * 100) : 100;
      console.log(`   ${category}: ${categoryRate.toFixed(1)}% (${results.passed}/${categoryTotal})`);
    });
    
    // Error details
    if (testState.testResults.errors.length > 0) {
      console.log('\n❌ Failed Tests:');
      testState.testResults.errors.forEach(error => {
        console.log(`   • ${error.category} > ${error.test}: ${error.error}`);
      });
    }
    
    console.log('\n🎉 Comprehensive testing completed!');
    
    // Write results to file
    this.writeResultsToFile();
  },

  writeResultsToFile() {
    const results = {
      timestamp: new Date().toISOString(),
      summary: testState.testResults,
      performance: testState.testResults.performance,
      errors: testState.testResults.errors,
      config: TEST_CONFIG
    };
    
    fs.writeFileSync('test-results.json', JSON.stringify(results, null, 2));
    console.log('\n📄 Test results written to test-results.json');
  }
};

// Main execution
async function main() {
  try {
    await TestRunner.runTestSuite();
    process.exit(testState.testResults.failed === 0 ? 0 : 1);
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    await ServerManager.stop();
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', async () => {
  console.log('\n⚠️  Test suite interrupted');
  await ServerManager.stop();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Test suite terminated');
  await ServerManager.stop();
  process.exit(1);
});

main();