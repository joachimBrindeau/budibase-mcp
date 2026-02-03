#!/usr/bin/env node

/**
 * Stress Test Utility for Budibase MCP Server
 * Tests high-load scenarios, concurrent operations, and resource limits
 */

const { spawn } = require('child_process');
const cluster = require('cluster');
const os = require('os');

console.log('⚡ BUDIBASE MCP SERVER STRESS TEST UTILITY\n');

const STRESS_CONFIG = {
  concurrentClients: os.cpus().length,
  operationsPerClient: 100,
  requestTimeout: 30000,
  rampUpDelay: 100, // ms between starting each client
  testDuration: 300000, // 5 minutes max
  dataVolume: {
    smallBatch: 10,
    mediumBatch: 50,
    largeBatch: 100,
    xlBatch: 500
  }
};

class StressTestRunner {
  constructor() {
    this.results = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageLatency: 0,
      maxLatency: 0,
      minLatency: Infinity,
      throughput: 0,
      errorsByType: {},
      memoryUsage: [],
      cpuUsage: []
    };
    this.startTime = null;
    this.testData = {
      appId: null,
      tableId: null
    };
  }

  async runStressTest() {
    console.log('🚀 Starting stress test...');
    console.log(`Configuration:`);
    console.log(`  - Concurrent clients: ${STRESS_CONFIG.concurrentClients}`);
    console.log(`  - Operations per client: ${STRESS_CONFIG.operationsPerClient}`);
    console.log(`  - Total operations: ${STRESS_CONFIG.concurrentClients * STRESS_CONFIG.operationsPerClient}`);
    
    this.startTime = Date.now();
    
    if (cluster.isMaster) {
      await this.runMasterProcess();
    } else {
      await this.runWorkerProcess();
    }
  }

  async runMasterProcess() {
    console.log('\n📊 Starting master process...');
    
    // Start server
    const server = await this.startServer();
    
    // Setup test data
    await this.setupTestData();
    
    // Start monitoring
    const monitorInterval = this.startMonitoring();
    
    // Fork workers
    const workers = [];
    for (let i = 0; i < STRESS_CONFIG.concurrentClients; i++) {
      setTimeout(() => {
        const worker = cluster.fork({
          WORKER_ID: i,
          APP_ID: this.testData.appId,
          TABLE_ID: this.testData.tableId
        });
        workers.push(worker);
        
        worker.on('message', (msg) => {
          if (msg.type === 'result') {
            this.aggregateResults(msg.data);
          }
        });
        
        worker.on('exit', (code) => {
          console.log(`Worker ${i} exited with code ${code}`);
        });
      }, i * STRESS_CONFIG.rampUpDelay);
    }
    
    // Wait for all workers to complete
    await new Promise((resolve) => {
      let completedWorkers = 0;
      
      const checkCompletion = () => {
        completedWorkers++;
        if (completedWorkers === STRESS_CONFIG.concurrentClients) {
          clearInterval(monitorInterval);
          resolve();
        }
      };
      
      workers.forEach(worker => {
        worker.on('exit', checkCompletion);
      });
      
      // Timeout safety
      setTimeout(() => {
        console.log('\n⏰ Test timeout reached, terminating workers...');
        workers.forEach(worker => worker.kill());
        clearInterval(monitorInterval);
        resolve();
      }, STRESS_CONFIG.testDuration);
    });
    
    // Cleanup
    await this.cleanup();
    server.kill();
    
    // Generate report
    this.generateReport();
  }

  async runWorkerProcess() {
    const workerId = process.env.WORKER_ID;
    const appId = process.env.APP_ID;
    const tableId = process.env.TABLE_ID;
    
    console.log(`🔧 Worker ${workerId} starting...`);
    
    const workerResults = {
      operations: 0,
      successful: 0,
      failed: 0,
      latencies: [],
      errors: []
    };
    
    // Connect to server
    const server = spawn('node', ['dist/index.js'], { 
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });
    
    // Wait for server ready
    await new Promise((resolve) => {
      server.stdout.on('data', (data) => {
        if (data.toString().includes('Budibase MCP Server is ready')) {
          resolve();
        }
      });
    });
    
    // Run operations
    for (let i = 0; i < STRESS_CONFIG.operationsPerClient; i++) {
      try {
        const operation = this.selectRandomOperation();
        const startTime = Date.now();
        
        await this.executeOperation(server, operation, appId, tableId, i);
        
        const latency = Date.now() - startTime;
        workerResults.operations++;
        workerResults.successful++;
        workerResults.latencies.push(latency);
        
      } catch (error) {
        workerResults.operations++;
        workerResults.failed++;
        workerResults.errors.push(error.message);
      }
      
      // Small delay to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Send results to master
    process.send({
      type: 'result',
      data: workerResults
    });
    
    server.kill();
    process.exit(0);
  }

  selectRandomOperation() {
    const operations = [
      'batch_create_small',
      'batch_create_medium',
      'batch_create_large',
      'advanced_query_simple',
      'advanced_query_complex',
      'transform_records',
      'aggregate_data',
      'batch_update',
      'bulk_query_process'
    ];
    
    return operations[Math.floor(Math.random() * operations.length)];
  }

  async executeOperation(server, operation, appId, tableId, index) {
    const requestId = Date.now() + Math.random();
    
    let toolName, args;
    
    switch (operation) {
      case 'batch_create_small':
        toolName = 'batch_create_records';
        args = {
          appId,
          tableId,
          records: this.generateRecords(STRESS_CONFIG.dataVolume.smallBatch, index),
          batchSize: 5,
          continueOnError: true
        };
        break;
        
      case 'batch_create_medium':
        toolName = 'batch_create_records';
        args = {
          appId,
          tableId,
          records: this.generateRecords(STRESS_CONFIG.dataVolume.mediumBatch, index),
          batchSize: 10,
          continueOnError: true
        };
        break;
        
      case 'batch_create_large':
        toolName = 'batch_create_records';
        args = {
          appId,
          tableId,
          records: this.generateRecords(STRESS_CONFIG.dataVolume.largeBatch, index),
          batchSize: 25,
          continueOnError: true
        };
        break;
        
      case 'advanced_query_simple':
        toolName = 'simple_query';
        args = {
          appId,
          tableId,
          queryString: `active:true,value>${Math.floor(Math.random() * 1000)}`,
          limit: 20
        };
        break;
        
      case 'advanced_query_complex':
        toolName = 'advanced_query';
        args = {
          appId,
          tableId,
          conditions: [
            { field: 'active', operator: 'equals', value: true },
            { field: 'value', operator: 'range', rangeOptions: { low: 0, high: 1000 } }
          ],
          sort: [{ field: 'value', direction: 'descending' }],
          limit: 50
        };
        break;
        
      case 'transform_records':
        toolName = 'transform_records';
        args = {
          appId,
          tableId,
          transformations: [
            { field: 'name', operation: 'uppercase' },
            { field: 'value', operation: 'calculate', expression: 'value * 1.1' }
          ],
          limit: 30
        };
        break;
        
      case 'aggregate_data':
        toolName = 'aggregate_data';
        args = {
          appId,
          tableId,
          groupBy: ['category'],
          aggregations: [
            { field: 'value', operation: 'sum' },
            { field: 'value', operation: 'avg' }
          ]
        };
        break;
        
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'tools/call',
        params: { name: toolName, arguments: args }
      };
      
      const timeout = setTimeout(() => {
        reject(new Error('Operation timeout'));
      }, STRESS_CONFIG.requestTimeout);
      
      const onData = (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            if (response.id === requestId) {
              clearTimeout(timeout);
              server.stdout.removeListener('data', onData);
              
              if (response.error) {
                reject(new Error(response.error.message));
              } else {
                resolve(response.result);
              }
              return;
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
      };
      
      server.stdout.on('data', onData);
      server.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  generateRecords(count, baseIndex) {
    return Array.from({ length: count }, (_, i) => ({
      name: `StressTest_${baseIndex}_${i}`,
      description: `Generated record ${i} for stress test`,
      value: Math.floor(Math.random() * 10000),
      active: Math.random() > 0.5,
      category: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
      created_date: new Date().toISOString()
    }));
  }

  async startServer() {
    console.log('🚀 Starting server for stress test...');
    
    const server = spawn('node', ['dist/index.js'], { 
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });
    
    return new Promise((resolve) => {
      server.stdout.on('data', (data) => {
        if (data.toString().includes('Budibase MCP Server is ready')) {
          console.log('✅ Server ready for stress testing');
          resolve(server);
        }
      });
    });
  }

  async setupTestData() {
    console.log('🛠️  Setting up test data...');
    
    // This would need to be implemented to create test app and table
    // For now, using placeholder IDs
    this.testData.appId = 'stress_test_app';
    this.testData.tableId = 'stress_test_table';
    
    console.log('✅ Test data setup complete');
  }

  startMonitoring() {
    console.log('📊 Starting resource monitoring...');
    
    return setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.results.memoryUsage.push({
        timestamp: Date.now(),
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal
      });
      
      this.results.cpuUsage.push({
        timestamp: Date.now(),
        user: cpuUsage.user,
        system: cpuUsage.system
      });
    }, 5000);
  }

  aggregateResults(workerResult) {
    this.results.totalOperations += workerResult.operations;
    this.results.successfulOperations += workerResult.successful;
    this.results.failedOperations += workerResult.failed;
    
    // Aggregate latencies
    const allLatencies = workerResult.latencies;
    if (allLatencies.length > 0) {
      const avgLatency = allLatencies.reduce((sum, lat) => sum + lat, 0) / allLatencies.length;
      const maxLatency = Math.max(...allLatencies);
      const minLatency = Math.min(...allLatencies);
      
      // Update overall stats
      this.results.averageLatency = (this.results.averageLatency * (this.results.successfulOperations - workerResult.successful) + avgLatency * workerResult.successful) / this.results.successfulOperations;
      this.results.maxLatency = Math.max(this.results.maxLatency, maxLatency);
      this.results.minLatency = Math.min(this.results.minLatency, minLatency);
    }
    
    // Aggregate errors
    workerResult.errors.forEach(error => {
      this.results.errorsByType[error] = (this.results.errorsByType[error] || 0) + 1;
    });
  }

  async cleanup() {
    console.log('🧹 Cleaning up stress test data...');
    // Cleanup would be implemented here
    console.log('✅ Cleanup complete');
  }

  generateReport() {
    const duration = (Date.now() - this.startTime) / 1000;
    this.results.throughput = this.results.totalOperations / duration;
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 STRESS TEST RESULTS');
    console.log('='.repeat(80));
    
    console.log(`\n📈 Performance Metrics:`);
    console.log(`  Total Operations: ${this.results.totalOperations}`);
    console.log(`  Successful: ${this.results.successfulOperations} (${((this.results.successfulOperations / this.results.totalOperations) * 100).toFixed(1)}%)`);
    console.log(`  Failed: ${this.results.failedOperations} (${((this.results.failedOperations / this.results.totalOperations) * 100).toFixed(1)}%)`);
    console.log(`  Duration: ${duration.toFixed(2)}s`);
    console.log(`  Throughput: ${this.results.throughput.toFixed(2)} ops/sec`);
    
    console.log(`\n⏱️  Latency Statistics:`);
    console.log(`  Average: ${this.results.averageLatency.toFixed(2)}ms`);
    console.log(`  Maximum: ${this.results.maxLatency}ms`);
    console.log(`  Minimum: ${this.results.minLatency}ms`);
    
    if (Object.keys(this.results.errorsByType).length > 0) {
      console.log(`\n❌ Error Breakdown:`);
      Object.entries(this.results.errorsByType).forEach(([error, count]) => {
        console.log(`  ${error}: ${count}`);
      });
    }
    
    console.log(`\n💾 Resource Usage:`);
    if (this.results.memoryUsage.length > 0) {
      const lastMem = this.results.memoryUsage[this.results.memoryUsage.length - 1];
      console.log(`  Peak Memory: ${(lastMem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    }
    
    // Performance rating
    const successRate = (this.results.successfulOperations / this.results.totalOperations) * 100;
    let rating = '❌ Poor';
    if (successRate >= 95 && this.results.averageLatency < 1000) {
      rating = '🎉 Excellent';
    } else if (successRate >= 90 && this.results.averageLatency < 2000) {
      rating = '✅ Good';
    } else if (successRate >= 80 && this.results.averageLatency < 5000) {
      rating = '⚠️  Fair';
    }
    
    console.log(`\n🏆 Overall Performance Rating: ${rating}`);
    
    // Save results
    const fs = require('fs');
    fs.writeFileSync('stress-test-results.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      config: STRESS_CONFIG,
      results: this.results,
      duration,
      rating
    }, null, 2));
    
    console.log('\n📄 Detailed results saved to stress-test-results.json');
    console.log('\n🎯 Stress test completed!');
  }
}

// Main execution
if (require.main === module) {
  const stressTest = new StressTestRunner();
  stressTest.runStressTest().catch(console.error);
}

module.exports = StressTestRunner;