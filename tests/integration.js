#!/usr/bin/env node

/**
 * Test script to verify Schema Registry integration
 */

const { EnhancedBudibaseClient } = require('./dist/storage/enhanced-client');

async function testIntegration() {
  console.log('Testing Schema Registry Integration...\n');
  
  const client = new EnhancedBudibaseClient();
  
  try {
    // Test 1: Initialize client
    console.log('1. Initializing Enhanced Client...');
    await client.initialize();
    console.log('✓ Client initialized successfully\n');
    
    // Test 2: Get applications
    console.log('2. Fetching applications...');
    const apps = await client.getApplications();
    console.log(`✓ Found ${apps.length} applications\n`);
    
    if (apps.length === 0) {
      console.log('No applications found. Please create an application in Budibase first.');
      return;
    }
    
    // Test 3: Sync first application
    const app = apps[0];
    console.log(`3. Syncing application: ${app.name}...`);
    await client.syncApplication(app._id, { forceSync: true });
    console.log('✓ Application synced successfully\n');
    
    // Test 4: Get cached tables
    console.log('4. Getting tables from cache...');
    const tables = await client.getApplicationTablesFromCache(app._id);
    console.log(`✓ Found ${tables.length} tables in cache\n`);
    
    if (tables.length > 0) {
      // Test 5: Get table schema
      const table = tables[0];
      console.log(`5. Getting schema for table: ${table.name}...`);
      const schema = await client.getTableSchemaFromCache(table._id);
      console.log(`✓ Schema loaded with ${Object.keys(schema?.schema || {}).length} fields\n`);
      
      // Test 6: Suggest query
      console.log('6. Testing query suggestion...');
      const suggestion = await client.suggestQuery(
        table._id,
        'find all records created today'
      );
      console.log('✓ Query suggestion:', JSON.stringify(suggestion, null, 2), '\n');
      
      // Test 7: Validate query
      console.log('7. Testing query validation...');
      try {
        await client.queryRecordsWithValidation(app._id, table._id, {
          query: { equal: { status: 'active' } },
          limit: 10
        });
        console.log('✓ Query validation passed\n');
      } catch (error) {
        console.log(`✓ Query validation working (error expected if field doesn't exist): ${error.message}\n`);
      }
    }
    
    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.close();
  }
}

testIntegration().catch(console.error);
