#!/usr/bin/env node

/**
 * Full CRUD test for all Budibase MCP Server endpoints
 * Creates a test application and tests all operations
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Full CRUD Test Suite for Budibase MCP Server\n');

// Test data storage
let testData = {
  appId: null,
  appName: `MCP_Test_${Date.now()}`,
  tableId: null,
  tableName: 'test_table',
  rowIds: [],
  userId: null,
  userEmail: `mcp_test_${Date.now()}@example.com`,
  queryId: null
};

// Track what we've created for cleanup
let cleanup = {
  apps: [],
  tables: [],
  rows: [],
  users: []
};

async function runTests() {
  return new Promise((resolve, reject) => {
    const server = spawn('node', ['dist/index.js'], { 
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: __dirname 
    });

    let serverReady = false;
    let testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: []
    };

    server.stdout.on('data', (data) => {
      const text = data.toString();
      if (text.includes('Budibase MCP Server is ready')) {
        serverReady = true;
        console.log('✅ Server started successfully\n');
        runAllTests();
      }
    });

    server.stderr.on('data', (data) => {
      console.error('[SERVER ERROR]', data.toString());
    });

    // Send MCP request helper
    function sendMCPRequest(method, params = {}) {
      return new Promise((resolve, reject) => {
        const request = {
          jsonrpc: "2.0",
          id: Date.now(),
          method: method,
          params: params
        };

        const requestLine = JSON.stringify(request) + '\n';
        server.stdin.write(requestLine);

        const responseHandler = (data) => {
          try {
            const lines = data.toString().split('\n').filter(line => line.trim());
            for (const line of lines) {
              if (line.trim().startsWith('{')) {
                const response = JSON.parse(line);
                if (response.id === request.id) {
                  server.stdout.removeListener('data', responseHandler);
                  resolve(response);
                  return;
                }
              }
            }
          } catch (error) {
            // Continue listening
          }
        };

        server.stdout.on('data', responseHandler);

        setTimeout(() => {
          server.stdout.removeListener('data', responseHandler);
          reject(new Error('Request timeout'));
        }, 10000);
      });
    }

    // Test helper
    async function runTest(name, toolName, args, processResult) {
      console.log(`\n📌 ${name}`);
      testResults.total++;

      try {
        const response = await sendMCPRequest('tools/call', {
          name: toolName,
          arguments: args
        });

        if (response.error) {
          throw new Error(response.error.message || 'Unknown error');
        }

        if (response.result && response.result.content) {
          const content = JSON.parse(response.result.content[0].text);
          console.log(`   ✅ Success: ${content.message}`);
          
          if (processResult) {
            processResult(content);
          }
          
          testResults.passed++;
          return content;
        } else {
          throw new Error('No valid response content');
        }
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        testResults.failed++;
        testResults.errors.push({ test: name, error: error.message });
        throw error;
      }
    }

    // Run all tests
    async function runAllTests() {
      try {
        console.log('🔧 Starting comprehensive CRUD tests...\n');

        // ========== APPLICATION TESTS ==========
        console.log('=== APPLICATION ENDPOINTS ===');
        
        // Create application
        await runTest('Create Application', 'create_application', {
          name: testData.appName,
          url: `/test-mcp-${Date.now()}`
        }, (result) => {
          console.log('   Response:', JSON.stringify(result.data, null, 2));
          testData.appId = result.data.application?._id || result.data._id || result.data.appId;
          cleanup.apps.push(testData.appId);
          console.log(`   Created app ID: ${testData.appId}`);
        });

        // List applications
        await runTest('List Applications', 'list_applications', {});

        // Get specific application
        await runTest('Get Application', 'get_application', {
          appId: testData.appId
        });

        // Update application
        await runTest('Update Application', 'update_application', {
          appId: testData.appId,
          name: testData.appName + '_Updated'
        });

        // Discover apps with tables
        await runTest('Discover Apps', 'discover_apps', {
          includeTables: true
        });

        // ========== TABLE TESTS ==========
        console.log('\n=== TABLE ENDPOINTS ===');

        // Create table
        await runTest('Create Table', 'create_table', {
          appId: testData.appId,
          name: testData.tableName,
          schema: {
            name: {
              type: 'string',
              name: 'name',
              constraints: {
                type: 'string',
                presence: true
              }
            },
            email: {
              type: 'string',
              name: 'email',
              constraints: {
                type: 'string'
              }
            },
            age: {
              type: 'number',
              name: 'age',
              constraints: {
                type: 'number'
              }
            },
            active: {
              type: 'boolean',
              name: 'active'
            }
          },
          primaryDisplay: 'name'
        }, (result) => {
          testData.tableId = result.data.table._id;
          cleanup.tables.push({ appId: testData.appId, tableId: testData.tableId });
          console.log(`   Created table ID: ${testData.tableId}`);
        });

        // List tables
        await runTest('List Tables', 'list_tables', {
          appId: testData.appId
        });

        // Get table schema
        await runTest('Get Table Schema', 'get_table_schema', {
          appId: testData.appId,
          tableId: testData.tableId
        });

        // Get current table schema first
        let currentTableSchema = null;
        await runTest('Get Table for Update', 'get_table_schema', {
          appId: testData.appId,
          tableId: testData.tableId
        }, (result) => {
          console.log('   Table data:', JSON.stringify(result.data, null, 2));
          currentTableSchema = result.data.table?.schema || result.data.tables?.[0]?.schema;
        });

        // Update table (must include schema)
        if (currentTableSchema) {
          await runTest('Update Table', 'update_table', {
            appId: testData.appId,
            tableId: testData.tableId,
            name: testData.tableName + '_updated',
            schema: currentTableSchema
          });
        }

        // ========== ROW/RECORD TESTS ==========
        console.log('\n=== ROW/RECORD ENDPOINTS ===');

        // Create multiple records
        for (let i = 1; i <= 3; i++) {
          await runTest(`Create Record ${i}`, 'create_record', {
            appId: testData.appId,
            tableId: testData.tableId,
            data: {
              name: `Test User ${i}`,
              email: `test${i}@example.com`,
              age: 20 + i,
              active: i % 2 === 1
            }
          }, (result) => {
            const rowId = result.data._id || result.data.data?._id;
            console.log(`   Created row ID: ${rowId}`);
            testData.rowIds.push(rowId);
            cleanup.rows.push({ 
              appId: testData.appId, 
              tableId: testData.tableId, 
              rowId: rowId 
            });
          });
        }

        // Query records
        await runTest('Query Records', 'query_records', {
          appId: testData.appId,
          tableId: testData.tableId,
          query: {
            equal: { active: true }
          },
          limit: 10
        });

        // Get specific record
        if (testData.rowIds.length > 0) {
          console.log(`   Using row ID: ${testData.rowIds[0]}`);
          await runTest('Get Row', 'get_row', {
            appId: testData.appId,
            tableId: testData.tableId,
            rowId: testData.rowIds[0]
          });

          // Update record
          await runTest('Update Record', 'update_record', {
            appId: testData.appId,
            tableId: testData.tableId,
            recordId: testData.rowIds[0],
            data: {
              name: 'Updated Test User',
              age: 30
            }
          });
        }

        // ========== USER TESTS ==========
        console.log('\n=== USER ENDPOINTS ===');

        // Create user
        await runTest('Create User', 'create_user', {
          email: testData.userEmail,
          password: 'TestPassword123!',
          firstName: 'MCP',
          lastName: 'Test'
        }, (result) => {
          testData.userId = result.data.user._id;
          cleanup.users.push(testData.userId);
          console.log(`   Created user ID: ${testData.userId}`);
        });

        // List users
        await runTest('List Users', 'list_users', {});

        // Get specific user
        await runTest('Get User', 'get_user', {
          userId: testData.userId
        });

        // Update user
        await runTest('Update User', 'update_user', {
          userId: testData.userId,
          firstName: 'MCP Updated',
          status: 'active'
        });

        // ========== QUERY TESTS ==========
        console.log('\n=== QUERY ENDPOINTS ===');

        // Search queries
        await runTest('Search Queries', 'search_queries', {
          appId: testData.appId
        }, (result) => {
          if (result.data.queries && result.data.queries.length > 0) {
            testData.queryId = result.data.queries[0].id;
          }
        });


        // ========== PUBLISH/EXPORT TESTS ==========
        console.log('\n=== ADVANCED APPLICATION ENDPOINTS ===');

        // Publish application
        await runTest('Publish Application', 'publish_application', {
          appId: testData.appId
        });


        // Unpublish application
        await runTest('Unpublish Application', 'unpublish_application', {
          appId: testData.appId
        });

        // ========== CLEANUP ==========
        console.log('\n=== CLEANUP ===');

        // Delete records
        for (const row of cleanup.rows) {
          await runTest(`Delete Record ${row.rowId}`, 'delete_record', {
            appId: row.appId,
            tableId: row.tableId,
            recordId: row.rowId
          });
        }

        // Delete table
        if (testData.tableId) {
          await runTest('Delete Table', 'delete_table', {
            appId: testData.appId,
            tableId: testData.tableId
          });
        }

        // Delete user
        if (testData.userId) {
          await runTest('Delete User', 'delete_user', {
            userId: testData.userId
          });
        }

        // Delete application
        if (testData.appId) {
          await runTest('Delete Application', 'delete_application', {
            appId: testData.appId
          });
        }

        // ========== SUMMARY ==========
        console.log('\n' + '='.repeat(50));
        console.log('📊 FULL CRUD TEST SUMMARY');
        console.log('='.repeat(50));
        console.log(`Total tests: ${testResults.total}`);
        console.log(`✅ Passed: ${testResults.passed}`);
        console.log(`❌ Failed: ${testResults.failed}`);
        console.log(`Success rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

        if (testResults.errors.length > 0) {
          console.log('\n❌ ERRORS:');
          testResults.errors.forEach(err => {
            console.log(`   - ${err.test}: ${err.error}`);
          });
        }

        console.log('\n✅ Test application and data cleaned up successfully!');

      } catch (error) {
        console.error('\n💥 Test suite failed:', error.message);
        
        // Attempt cleanup on failure
        console.log('\n🧹 Attempting cleanup after failure...');
        try {
          if (testData.appId) {
            await sendMCPRequest('tools/call', {
              name: 'delete_application',
              arguments: { appId: testData.appId }
            });
            console.log('✅ Cleaned up test application');
          }
        } catch (cleanupError) {
          console.log('⚠️  Cleanup failed, manual cleanup may be required');
        }
      }

      // Shutdown
      server.kill('SIGTERM');
      resolve(testResults);
    }

    server.on('close', (code) => {
      if (!serverReady) {
        reject(new Error('Server failed to start'));
      }
    });

    setTimeout(() => {
      if (!serverReady) {
        server.kill('SIGTERM');
        reject(new Error('Server startup timeout'));
      }
    }, 15000);
  });
}

// Run tests
runTests()
  .then(results => {
    console.log('\n🎉 Full CRUD test suite completed!');
    process.exit(results.failed === 0 ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Test suite failed:', error.message);
    process.exit(1);
  });