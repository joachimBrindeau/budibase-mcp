# Test Data Overview

This directory contains structured test datasets for comprehensive testing of the Budibase MCP Server.

## Dataset Categories

### Basic Test Data

**simple_data.json** (7.3 KB)
- Basic CRUD operation testing
- Simple schema validation
- Quick functional tests

**users_data.json** (26 KB)
- User management testing
- Authentication/authorization scenarios
- User profile operations

**products_data.json** (47 KB)
- Product catalog operations
- E-commerce scenarios
- Inventory management testing

**orders_data.json** (38 KB)
- Order processing workflows
- Transaction handling
- Related record operations

### Edge Cases & Scenarios

**edge_cases.json** (5.0 KB)
- Boundary condition testing
- Null/undefined value handling
- Special character processing
- Data type validation

**test_scenarios.json** (5.1 KB)
- Complex workflow scenarios
- Multi-step operation testing
- Integration test cases

**comprehensive_data.json** (70 KB)
- Full feature coverage
- Combined operation testing
- End-to-end scenarios

### Performance Testing

**large_dataset_1000.json** (701 KB)
- 1,000 records for baseline performance
- Batch operation testing
- Query performance validation

**large_dataset_5000.json** (3.4 MB)
- 5,000 records for moderate load
- Pagination testing
- Memory usage validation

**large_dataset_10000.json** (6.8 MB)
- 10,000 records for high load
- Stress testing
- Performance optimization validation
- Concurrent operation testing

### Schema Definitions

**schemas.json** (3.5 KB)
- Table schema definitions
- Field type specifications
- Validation rules
- Relationship definitions

## Usage

### Running Tests with Specific Datasets

```bash
# Basic functionality tests
node tests/suite.js --data=tests/data/simple_data.json

# Performance benchmarks
node tests/stress.js --data=tests/data/large_dataset_10000.json

# Edge case validation
node tests/integration.js --data=tests/data/edge_cases.json
```

### Test Data Generation

```bash
# Generate new test data
node scripts/test-data-generator.js --generate-files
```

## Best Practices

1. **Use appropriate dataset sizes**: Start with simple_data.json for development, graduate to larger datasets for validation
2. **Performance testing**: Always use large_dataset_10000.json for final performance validation
3. **Edge cases first**: Run edge_cases.json before comprehensive testing
4. **Clean state**: Reset test environment between dataset runs to avoid contamination

## Dataset Maintenance

- Update schemas.json when table structures change
- Regenerate large datasets periodically to ensure variety
- Keep edge_cases.json synchronized with known issues and fixes
- Document new scenarios in test_scenarios.json
