# Comprehensive Testing Guide

This document describes the complete testing framework for the Budibase MCP Server, including setup, execution, and analysis of test results.

## Overview

The testing framework provides comprehensive coverage across multiple dimensions:

- **Functional Testing**: All features and tools
- **Integration Testing**: End-to-end workflows
- **Performance Testing**: Latency, throughput, and resource usage
- **Stress Testing**: High-load scenarios and concurrent operations
- **Security Testing**: Input validation and attack prevention
- **Edge Case Testing**: Boundary conditions and error scenarios

## Test Suite Components

### 1. Master Test Runner (`run-all-tests.sh`)

The main entry point that orchestrates all test suites:

```bash
# Run complete test suite
./run-all-tests.sh

# Run only basic tests
./run-all-tests.sh --basic-only

# Skip specific test types
./run-all-tests.sh --no-stress --no-performance

# Run without cleanup
./run-all-tests.sh --no-cleanup
```

**Features:**
- Automated environment setup
- Sequential execution of all test suites
- Result aggregation and reporting
- Comprehensive cleanup
- HTML report generation

### 2. Comprehensive Test Suite (`test-suite.js`)

Core functional testing covering all features:

```bash
# Run comprehensive tests directly
node test-suite.js
```

**Test Categories:**
- **Connectivity**: Server startup and basic communication
- **Applications**: CRUD operations on applications
- **Tables**: Schema management and table operations
- **Records**: Data manipulation (CRUD, queries)
- **Users**: User management operations
- **Queries**: Saved query operations
- **Advanced Queries**: Query builder functionality
- **Batch Operations**: Bulk data processing
- **Data Transformation**: Data manipulation and format conversion
- **Error Handling**: Invalid input and error scenarios
- **Performance**: Response time measurements
- **Edge Cases**: Boundary conditions
- **Security**: Input validation and attack prevention

### 3. Stress Testing (`stress-test.js`)

High-load testing with concurrent operations:

```bash
# Run stress tests
node stress-test.js
```

**Features:**
- Multi-process concurrent testing
- Configurable client count and operation volume
- Resource monitoring (CPU, memory)
- Throughput and latency measurement
- Error rate analysis

### 4. Test Data Generator (`test-data-generator.js`)

Generates realistic test data for comprehensive testing:

```bash
# Generate test data files
node test-data-generator.js --generate-files
```

**Generated Data:**
- Multiple schema types (simple, users, products, orders)
- Edge case data (null values, special characters)
- Large datasets for performance testing
- Realistic sample data with proper relationships

## Quick Start

### Prerequisites

1. **Environment Setup**:
   ```bash
   # Ensure .env file exists with:
   BUDIBASE_URL=your-budibase-url
   BUDIBASE_API_KEY=your-api-key
   ```

2. **Dependencies**:
   ```bash
   npm install
   npm run build
   ```

### Running Tests

1. **Complete Test Suite** (Recommended):
   ```bash
   ./run-all-tests.sh
   ```

2. **Quick Verification**:
   ```bash
   ./run-all-tests.sh --basic-only
   ```

3. **Performance Focus**:
   ```bash
   ./run-tests.sh --perf
   ```

## Test Configuration

### Environment Variables

```bash
# Test execution mode
export TEST_MODE="quick"          # quick, performance, security
export SKIP_CLEANUP="true"        # Skip cleanup phase
export TEST_TIMEOUT="300000"      # Test timeout in ms
```

### Configuration Files

1. **test-config.json**: Test suite configuration
2. **Test data schemas**: Generated realistic data structures
3. **Performance benchmarks**: Expected performance thresholds

## Test Result Analysis

### Result Files

All test results are saved in `test-results/` directory:

```
test-results/
├── comprehensive-results-TIMESTAMP.json
├── stress-results-TIMESTAMP.json
├── performance-results-TIMESTAMP.json
├── security-results-TIMESTAMP.json
├── consolidated-results.json
└── test-report-TIMESTAMP.html
```

### HTML Report

Open `test-report-TIMESTAMP.html` for visual analysis:
- Overall success rates
- Performance metrics
- Error breakdown
- Test duration analysis

### JSON Results

Detailed programmatic results in JSON format:

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "summary": {
    "total": 150,
    "passed": 142,
    "failed": 5,
    "skipped": 3,
    "successRate": 94.7
  },
  "performance": {
    "averageLatency": 245.6,
    "maxLatency": 1250,
    "throughput": 125.4
  },
  "errors": [...]
}
```

## Test Categories Explained

### 1. Functional Tests

**Purpose**: Verify all features work as expected

**Coverage**:
- All 27 implemented tools
- CRUD operations on all entities
- Query building and execution
- Batch operations
- Data transformations

**Example Test**:
```javascript
await runTest('Create Application', 'create_application', {
  name: 'Test App',
  url: 'test-app'
});
```

### 2. Integration Tests

**Purpose**: Test end-to-end workflows

**Scenarios**:
- Complete data lifecycle (create app → create table → add records → query → transform → cleanup)
- Cross-feature operations
- Complex multi-step processes

### 3. Performance Tests

**Purpose**: Measure response times and throughput

**Metrics**:
- Average latency per operation type
- Maximum response time
- Operations per second
- Memory usage patterns

**Thresholds**:
- Simple operations: < 500ms
- Complex queries: < 2000ms
- Batch operations: < 5000ms

### 4. Stress Tests

**Purpose**: Test system behavior under high load

**Scenarios**:
- Concurrent client connections
- High-volume batch operations
- Resource exhaustion conditions
- Error rate under stress

### 5. Security Tests

**Purpose**: Validate input sanitization and attack prevention

**Test Cases**:
- SQL injection attempts
- XSS payload detection
- Input validation bypass
- Path traversal attempts
- Code injection prevention

### 6. Edge Case Tests

**Purpose**: Test boundary conditions and unusual inputs

**Scenarios**:
- Empty/null values
- Extremely large inputs
- Special characters
- Unicode handling
- Numeric limits

## Performance Benchmarks

### Expected Performance

| Operation Type | Target Latency | Acceptable Range |
|---------------|----------------|------------------|
| List Operations | < 200ms | < 500ms |
| Simple Queries | < 300ms | < 800ms |
| Complex Queries | < 800ms | < 2000ms |
| Record Creation | < 400ms | < 1000ms |
| Batch Operations | < 2000ms | < 5000ms |
| Transformations | < 1000ms | < 3000ms |

### Throughput Targets

| Scenario | Target Rate | Minimum Acceptable |
|----------|-------------|-------------------|
| Concurrent Queries | > 50 ops/sec | > 20 ops/sec |
| Batch Processing | > 100 records/sec | > 50 records/sec |
| Simple Operations | > 100 ops/sec | > 50 ops/sec |

## Troubleshooting

### Common Issues

1. **Server Startup Timeout**:
   ```bash
   # Check environment variables
   cat .env
   # Verify network connectivity
   curl -H "x-budibase-api-key: $BUDIBASE_API_KEY" "$BUDIBASE_URL/api/public/v1/metrics"
   ```

2. **Test Failures**:
   ```bash
   # Run individual test categories
   ./run-tests.sh --basic-only
   # Check detailed logs
   cat test-results/comprehensive-test-*.log
   ```

3. **Performance Issues**:
   ```bash
   # Monitor system resources
   top
   # Check network latency
   ping your-budibase-url
   ```

### Debug Mode

Enable verbose logging:

```bash
export LOG_LEVEL=debug
export NODE_ENV=development
./run-all-tests.sh
```

## Contributing to Tests

### Adding New Tests

1. **Add test to appropriate category** in `test-suite.js`:
   ```javascript
   await this.runTest('New Feature Test', 'New Feature', async () => {
     return await ServerManager.sendRequest('new_tool', {
       param1: 'value1'
     });
   });
   ```

2. **Create edge cases**:
   ```javascript
   await this.runTest('New Feature Edge Case', 'New Feature Invalid Input', async () => {
     return await ServerManager.sendRequest('new_tool', {
       param1: null // Test null handling
     });
   }, { expectedToFail: true });
   ```

3. **Add performance test**:
   ```javascript
   await this.runTest('New Feature Performance', 'New Feature', async () => {
     return await ServerManager.sendRequest('new_tool', validArgs);
   }, { performance: true });
   ```

### Test Data Guidelines

- Use realistic data that represents actual usage
- Include edge cases and boundary conditions
- Ensure data cleanup after tests
- Use deterministic data generation for reproducible tests

### Performance Test Guidelines

- Measure actual operations, not mock responses
- Test with realistic data volumes
- Include both single and batch operations
- Monitor resource usage during tests

## Continuous Integration

### Automated Testing

For CI/CD integration:

```yaml
# Example GitHub Actions workflow
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run build
      - run: ./run-all-tests.sh --no-stress
      - uses: actions/upload-artifact@v2
        with:
          name: test-results
          path: test-results/
```

### Quality Gates

- **Minimum Success Rate**: 95%
- **Maximum Average Latency**: 1000ms
- **No Critical Security Failures**: 0
- **Code Coverage**: > 80%

## Best Practices

### Test Execution

1. **Run tests in isolated environment**
2. **Use dedicated test data**
3. **Clean up after each test run**
4. **Monitor resource usage**
5. **Validate against live API**

### Test Development

1. **Write tests for new features immediately**
2. **Include negative test cases**
3. **Test error conditions**
4. **Measure performance impact**
5. **Document expected behavior**

### Result Analysis

1. **Review all test categories**
2. **Investigate performance regressions**
3. **Address security findings immediately**
4. **Track trends over time**
5. **Update benchmarks as needed**

---

This testing framework ensures the Budibase MCP Server maintains high quality, performance, and reliability across all supported operations and scenarios.