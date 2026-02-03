/**
 * Validate that all components are properly integrated
 */

const fs = require('fs');
const path = require('path');

const checks = [
  {
    name: 'Schema Registry files exist',
    check: () => {
      const files = [
        'src/storage/schema-registry.ts',
        'src/storage/smart-query-builder.ts',
        'src/storage/enhanced-client.ts',
        'src/storage/index.ts',
        'src/tools/schema.ts'
      ];
      return files.every(f => fs.existsSync(path.join(__dirname, f)));
    }
  },
  {
    name: 'Dependencies installed',
    check: () => {
      const pkg = require('./package.json');
      return pkg.dependencies.sqlite3 && pkg.dependencies.sqlite;
    }
  },
  {
    name: 'TypeScript configuration',
    check: () => {
      const tsconfig = require('./tsconfig.json');
      return tsconfig.compilerOptions.strict === true;
    }
  },
  {
    name: 'Migration script exists',
    check: () => fs.existsSync(path.join(__dirname, 'migrate-schema-registry.js'))
  },
  {
    name: 'Environment example updated',
    check: () => {
      const env = fs.readFileSync(path.join(__dirname, '.env.example'), 'utf8');
      return env.includes('SCHEMA_DB_PATH');
    }
  }
];

console.log('🔍 Validating Schema Registry Integration\n');

let passed = 0;
checks.forEach(({ name, check }) => {
  try {
    if (check()) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
    }
  } catch (error) {
    console.log(`❌ ${name} - ${error.message}`);
  }
});

console.log(`\n${passed}/${checks.length} checks passed`);

if (passed === checks.length) {
  console.log('\n🎉 All validation checks passed! Your MCP server is ready.');
} else {
  console.log('\n⚠️  Some checks failed. Please review the setup.');
  process.exit(1);
}
