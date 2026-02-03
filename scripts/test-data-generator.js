#!/usr/bin/env node

/**
 * Test Data Generator for Budibase MCP Server
 * Generates realistic test data for comprehensive testing
 */

const fs = require('fs');
const crypto = require('crypto');

class TestDataGenerator {
  constructor() {
    this.config = {
      recordCounts: [10, 50, 100, 500, 1000],
      dataTypes: ['string', 'number', 'boolean', 'datetime', 'email', 'url', 'json'],
      categories: ['Electronics', 'Clothing', 'Books', 'Home', 'Sports', 'Automotive', 'Health', 'Food'],
      departments: ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Support'],
      statuses: ['active', 'inactive', 'pending', 'archived', 'draft'],
      countries: ['USA', 'Canada', 'UK', 'Germany', 'France', 'Japan', 'Australia', 'Brazil'],
      companies: ['Acme Corp', 'TechFlow', 'DataSys', 'CloudCorp', 'InnovateLabs', 'SmartSolutions']
    };
  }

  // Generate realistic names
  generateName(type = 'person') {
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Jessica', 'William', 'Ashley'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    const productNames = ['Pro', 'Elite', 'Premium', 'Standard', 'Basic', 'Advanced', 'Ultimate', 'Deluxe'];
    const productTypes = ['Widget', 'Gadget', 'Tool', 'Device', 'System', 'Platform', 'Solution', 'Kit'];
    
    if (type === 'person') {
      return `${this.randomChoice(firstNames)} ${this.randomChoice(lastNames)}`;
    } else if (type === 'product') {
      return `${this.randomChoice(productNames)} ${this.randomChoice(productTypes)} ${Math.floor(Math.random() * 1000)}`;
    } else if (type === 'company') {
      return this.randomChoice(this.config.companies);
    }
    
    return 'Generated Name';
  }

  // Generate realistic email
  generateEmail(name = null) {
    const domains = ['example.com', 'test.org', 'demo.net', 'sample.co', 'mock.io'];
    const baseName = name ? name.toLowerCase().replace(/\s+/g, '.') : `user${Math.floor(Math.random() * 10000)}`;
    return `${baseName}@${this.randomChoice(domains)}`;
  }

  // Generate phone number
  generatePhone() {
    const formats = [
      '+1-XXX-XXX-XXXX',
      '(XXX) XXX-XXXX',
      'XXX.XXX.XXXX',
      'XXX-XXX-XXXX'
    ];
    
    const format = this.randomChoice(formats);
    return format.replace(/X/g, () => Math.floor(Math.random() * 10));
  }

  // Generate address
  generateAddress() {
    const streets = ['Main St', 'Oak Ave', 'First St', 'Second Ave', 'Park Rd', 'Elm St', 'Broadway', 'Washington St'];
    const cities = ['Springfield', 'Franklin', 'Georgetown', 'Madison', 'Salem', 'Chester', 'Fairview', 'Burlington'];
    const states = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI'];
    
    return {
      street: `${Math.floor(Math.random() * 9999) + 1} ${this.randomChoice(streets)}`,
      city: this.randomChoice(cities),
      state: this.randomChoice(states),
      zipCode: String(Math.floor(Math.random() * 90000) + 10000),
      country: this.randomChoice(this.config.countries)
    };
  }

  // Generate UUID
  generateUuid() {
    return crypto.randomUUID();
  }

  // Generate random choice from array
  randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  // Generate random number in range
  randomNumber(min = 0, max = 1000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Generate random decimal
  randomDecimal(min = 0, max = 1000, decimals = 2) {
    const num = Math.random() * (max - min) + min;
    return parseFloat(num.toFixed(decimals));
  }

  // Generate random date
  generateDate(startYear = 2020, endYear = 2024) {
    const start = new Date(startYear, 0, 1);
    const end = new Date(endYear, 11, 31);
    const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
    return new Date(randomTime).toISOString();
  }

  // Generate lorem ipsum text
  generateLoremIpsum(wordCount = 10) {
    const words = [
      'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
      'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
      'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
      'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
      'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit', 'voluptate',
      'velit', 'esse', 'cillum', 'fugiat', 'nulla', 'pariatur', 'excepteur', 'sint',
      'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
      'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum'
    ];
    
    const selectedWords = [];
    for (let i = 0; i < wordCount; i++) {
      selectedWords.push(this.randomChoice(words));
    }
    
    return selectedWords.join(' ');
  }

  // Generate table schema
  generateTableSchema(schemaType = 'comprehensive') {
    const schemas = {
      simple: {
        name: { type: 'string', name: 'name' },
        value: { type: 'number', name: 'value' },
        active: { type: 'boolean', name: 'active' }
      },
      
      users: {
        name: { type: 'string', name: 'name' },
        email: { type: 'string', name: 'email' },
        phone: { type: 'string', name: 'phone' },
        department: { type: 'string', name: 'department' },
        salary: { type: 'number', name: 'salary' },
        hire_date: { type: 'datetime', name: 'hire_date' },
        active: { type: 'boolean', name: 'active' },
        address: { type: 'string', name: 'address' }
      },
      
      products: {
        name: { type: 'string', name: 'name' },
        description: { type: 'string', name: 'description' },
        category: { type: 'string', name: 'category' },
        price: { type: 'number', name: 'price' },
        cost: { type: 'number', name: 'cost' },
        quantity: { type: 'number', name: 'quantity' },
        sku: { type: 'string', name: 'sku' },
        active: { type: 'boolean', name: 'active' },
        created_date: { type: 'datetime', name: 'created_date' },
        updated_date: { type: 'datetime', name: 'updated_date' }
      },
      
      orders: {
        order_id: { type: 'string', name: 'order_id' },
        customer_name: { type: 'string', name: 'customer_name' },
        customer_email: { type: 'string', name: 'customer_email' },
        product_name: { type: 'string', name: 'product_name' },
        quantity: { type: 'number', name: 'quantity' },
        unit_price: { type: 'number', name: 'unit_price' },
        total_amount: { type: 'number', name: 'total_amount' },
        order_date: { type: 'datetime', name: 'order_date' },
        status: { type: 'string', name: 'status' },
        shipping_address: { type: 'string', name: 'shipping_address' }
      },
      
      comprehensive: {
        id: { type: 'string', name: 'id' },
        name: { type: 'string', name: 'name' },
        description: { type: 'string', name: 'description' },
        category: { type: 'string', name: 'category' },
        subcategory: { type: 'string', name: 'subcategory' },
        value: { type: 'number', name: 'value' },
        price: { type: 'number', name: 'price' },
        quantity: { type: 'number', name: 'quantity' },
        rating: { type: 'number', name: 'rating' },
        active: { type: 'boolean', name: 'active' },
        featured: { type: 'boolean', name: 'featured' },
        created_date: { type: 'datetime', name: 'created_date' },
        updated_date: { type: 'datetime', name: 'updated_date' },
        status: { type: 'string', name: 'status' },
        tags: { type: 'string', name: 'tags' },
        metadata: { type: 'string', name: 'metadata' }
      }
    };
    
    return schemas[schemaType] || schemas.comprehensive;
  }

  // Generate record based on schema
  generateRecord(schema, index = 1) {
    const record = {};
    
    Object.keys(schema).forEach(field => {
      const fieldType = schema[field].type;
      
      switch (fieldType) {
        case 'string':
          if (field.includes('email')) {
            record[field] = this.generateEmail();
          } else if (field.includes('phone')) {
            record[field] = this.generatePhone();
          } else if (field.includes('address')) {
            const addr = this.generateAddress();
            record[field] = `${addr.street}, ${addr.city}, ${addr.state} ${addr.zipCode}`;
          } else if (field.includes('name')) {
            record[field] = this.generateName(field.includes('product') ? 'product' : 'person');
          } else if (field.includes('description')) {
            record[field] = this.generateLoremIpsum(this.randomNumber(10, 50));
          } else if (field.includes('category')) {
            record[field] = this.randomChoice(this.config.categories);
          } else if (field.includes('department')) {
            record[field] = this.randomChoice(this.config.departments);
          } else if (field.includes('status')) {
            record[field] = this.randomChoice(this.config.statuses);
          } else if (field.includes('id')) {
            record[field] = this.generateUuid();
          } else if (field.includes('sku')) {
            record[field] = `SKU-${String(index).padStart(6, '0')}`;
          } else if (field.includes('tag')) {
            const tags = ['important', 'featured', 'new', 'sale', 'premium', 'popular'];
            record[field] = Array.from({length: this.randomNumber(1, 3)}, () => this.randomChoice(tags)).join(', ');
          } else if (field.includes('metadata')) {
            record[field] = JSON.stringify({
              source: 'generated',
              batch: Math.floor(index / 100),
              priority: this.randomChoice(['low', 'medium', 'high'])
            });
          } else {
            record[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} ${index}`;
          }
          break;
          
        case 'number':
          if (field.includes('price') || field.includes('cost') || field.includes('amount')) {
            record[field] = this.randomDecimal(10, 1000, 2);
          } else if (field.includes('salary')) {
            record[field] = this.randomNumber(30000, 150000);
          } else if (field.includes('quantity')) {
            record[field] = this.randomNumber(1, 100);
          } else if (field.includes('rating')) {
            record[field] = this.randomDecimal(1, 5, 1);
          } else {
            record[field] = this.randomNumber(1, 1000) + index;
          }
          break;
          
        case 'boolean':
          record[field] = Math.random() > 0.3; // 70% true, 30% false
          break;
          
        case 'datetime':
          record[field] = this.generateDate();
          break;
          
        default:
          record[field] = `${fieldType} value ${index}`;
      }
    });
    
    return record;
  }

  // Generate batch of records
  generateBatchRecords(schema, count) {
    return Array.from({ length: count }, (_, i) => this.generateRecord(schema, i + 1));
  }

  // Generate edge case data
  generateEdgeCaseData() {
    return {
      emptyStrings: {
        name: '',
        description: '',
        value: 0,
        active: false
      },
      
      nullValues: {
        name: null,
        description: null,
        value: null,
        active: null
      },
      
      extremeValues: {
        name: 'A'.repeat(1000),
        description: this.generateLoremIpsum(500),
        value: Number.MAX_SAFE_INTEGER,
        active: true
      },
      
      specialCharacters: {
        name: "Test with special chars: !@#$%^&*()_+-=[]{}|;':\",./<>?",
        description: "Unicode test: 你好 مرحبا здравствуй こんにちは 🎉🚀💻",
        value: -999999,
        active: false
      },
      
      sqlInjection: {
        name: "'; DROP TABLE users; --",
        description: "1' OR '1'='1",
        value: 0,
        active: true
      },
      
      xssAttempt: {
        name: "<script>alert('xss')</script>",
        description: "<img src=x onerror=alert('xss')>",
        value: 123,
        active: true
      }
    };
  }

  // Generate test scenarios
  generateTestScenarios() {
    return {
      bulkCreate: {
        description: 'Bulk record creation test',
        schema: this.generateTableSchema('comprehensive'),
        recordCounts: [10, 50, 100, 500, 1000]
      },
      
      queryPerformance: {
        description: 'Query performance test data',
        schema: this.generateTableSchema('products'),
        recordCount: 1000,
        queryConditions: [
          { field: 'active', operator: 'equals', value: true },
          { field: 'price', operator: 'range', rangeOptions: { low: 100, high: 500 } },
          { field: 'category', operator: 'in', values: ['Electronics', 'Books'] }
        ]
      },
      
      transformation: {
        description: 'Data transformation test data',
        schema: this.generateTableSchema('users'),
        recordCount: 100,
        transformations: [
          { field: 'name', operation: 'uppercase' },
          { field: 'email', operation: 'lowercase' },
          { field: 'salary', operation: 'calculate', expression: 'value * 1.1' }
        ]
      },
      
      aggregation: {
        description: 'Data aggregation test data',
        schema: this.generateTableSchema('orders'),
        recordCount: 500,
        groupBy: ['status', 'customer_name'],
        aggregations: [
          { field: 'total_amount', operation: 'sum' },
          { field: 'total_amount', operation: 'avg' },
          { field: 'order_id', operation: 'count' }
        ]
      }
    };
  }

  // Save test data to files
  saveTestDataToFiles() {
    const path = require('path');
    const outputDir = path.join(__dirname, '..', 'tests', 'data');
    
    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log('📁 Generating test data files...');
    
    // Generate schemas
    const schemas = {
      simple: this.generateTableSchema('simple'),
      users: this.generateTableSchema('users'),
      products: this.generateTableSchema('products'),
      orders: this.generateTableSchema('orders'),
      comprehensive: this.generateTableSchema('comprehensive')
    };
    
    fs.writeFileSync(`${outputDir}/schemas.json`, JSON.stringify(schemas, null, 2));
    console.log('✅ Generated schemas.json');
    
    // Generate sample data for each schema
    Object.entries(schemas).forEach(([schemaName, schema]) => {
      const records = this.generateBatchRecords(schema, 100);
      fs.writeFileSync(`${outputDir}/${schemaName}_data.json`, JSON.stringify(records, null, 2));
      console.log(`✅ Generated ${schemaName}_data.json (100 records)`);
    });
    
    // Generate edge case data
    const edgeCases = this.generateEdgeCaseData();
    fs.writeFileSync(`${outputDir}/edge_cases.json`, JSON.stringify(edgeCases, null, 2));
    console.log('✅ Generated edge_cases.json');
    
    // Generate test scenarios
    const scenarios = this.generateTestScenarios();
    fs.writeFileSync(`${outputDir}/test_scenarios.json`, JSON.stringify(scenarios, null, 2));
    console.log('✅ Generated test_scenarios.json');
    
    // Generate large datasets for performance testing
    [1000, 5000, 10000].forEach(count => {
      const largeDataset = this.generateBatchRecords(schemas.comprehensive, count);
      fs.writeFileSync(`${outputDir}/large_dataset_${count}.json`, JSON.stringify(largeDataset, null, 2));
      console.log(`✅ Generated large_dataset_${count}.json`);
    });
    
    console.log(`\n🎉 Test data generation complete! Files saved to ${outputDir}/`);
    console.log('\nGenerated files:');
    console.log('  - schemas.json (table schemas)');
    console.log('  - *_data.json (sample data for each schema)');
    console.log('  - edge_cases.json (edge case test data)');
    console.log('  - test_scenarios.json (predefined test scenarios)');
    console.log('  - large_dataset_*.json (performance test datasets)');
  }
}

// Main execution
if (require.main === module) {
  const generator = new TestDataGenerator();
  
  if (process.argv.includes('--generate-files')) {
    generator.saveTestDataToFiles();
  } else {
    console.log('Test Data Generator for Budibase MCP Server');
    console.log('Usage: node scripts/test-data-generator.js --generate-files');
    console.log('\nThis will generate comprehensive test data files in tests/data/');
  }
}

module.exports = TestDataGenerator;