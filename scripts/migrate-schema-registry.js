#!/usr/bin/env node

/**
 * Migration script to integrate Schema Registry into existing Budibase MCP Server
 */

const { promises: fs } = require('fs');
const path = require('path');

async function updateServerFile() {
  const serverPath = path.join(__dirname, 'src/server.ts');
  const content = await fs.readFile(serverPath, 'utf-8');
  
  // Check if already using EnhancedBudibaseClient
  if (content.includes('EnhancedBudibaseClient')) {
    console.log('✓ Server already using EnhancedBudibaseClient');
    return;
  }
  
  // Replace BudibaseClient import
  let updated = content.replace(
    "import { BudibaseClient } from './clients/budibase';",
    "import { EnhancedBudibaseClient } from './storage/enhanced-client';"
  );
  
  // Replace client instantiation
  updated = updated.replace(
    'private budibaseClient: BudibaseClient;',
    'private budibaseClient: EnhancedBudibaseClient;'
  );
  
  updated = updated.replace(
    'this.budibaseClient = new BudibaseClient();',
    'this.budibaseClient = new EnhancedBudibaseClient();'
  );
  
  await fs.writeFile(serverPath, updated);
  console.log('✓ Updated server.ts to use EnhancedBudibaseClient');
}

async function updateToolsIndex() {
  const toolsIndexPath = path.join(__dirname, 'src/tools/index.ts');
  const content = await fs.readFile(toolsIndexPath, 'utf-8');
  
  // Check if schema tools already imported
  if (content.includes('schemaTools')) {
    console.log('✓ Schema tools already imported');
    return;
  }
  
  // Add import
  const importLine = "import { schemaTools } from './schema';";
  const lines = content.split('\n');
  
  // Find last import
  let lastImportIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import')) {
      lastImportIndex = i;
    }
  }
  
  // Insert new import
  lines.splice(lastImportIndex + 1, 0, importLine);
  
  // Update exports
  const exportLine = lines.find(line => line.includes('export const tools'));
  if (exportLine) {
    const updatedExport = exportLine.replace('];', ', ...schemaTools];');
    const exportIndex = lines.indexOf(exportLine);
    lines[exportIndex] = updatedExport;
  }
  
  await fs.writeFile(toolsIndexPath, lines.join('\n'));
  console.log('✓ Added schema tools to tools index');
}

async function createDataDirectory() {
  const dataPath = path.join(__dirname, 'data');
  try {
    await fs.mkdir(dataPath, { recursive: true });
    console.log('✓ Created data directory');
  } catch (error) {
    console.log('✓ Data directory already exists');
  }
}

async function updateGitignore() {
  const gitignorePath = path.join(__dirname, '.gitignore');
  const content = await fs.readFile(gitignorePath, 'utf-8');
  
  if (content.includes('data/')) {
    console.log('✓ .gitignore already includes data directory');
    return;
  }
  
  await fs.appendFile(gitignorePath, '\n# Schema Registry Database\ndata/\n*.db\n');
  console.log('✓ Updated .gitignore');
}

async function createInitScript() {
  const initScriptPath = path.join(__dirname, 'init-schema-registry.js');
  const script = `#!/usr/bin/env node

/**
 * Initialize Schema Registry with all existing applications
 */

const { EnhancedBudibaseClient } = require('./dist/storage/enhanced-client');

async function init() {
  console.log('Initializing Schema Registry...');
  
  const client = new EnhancedBudibaseClient();
  await client.initialize();
  
  console.log('Fetching applications...');
  const apps = await client.getApplications();
  
  console.log(\`Found \${apps.length} applications\`);
  
  for (const app of apps) {
    console.log(\`Syncing \${app.name}...\`);
    try {
      await client.syncApplication(app._id, {
        forceSync: true,
        syncInterval: 3600000 // 1 hour
      });
      console.log(\`✓ Synced \${app.name}\`);
    } catch (error) {
      console.error(\`✗ Failed to sync \${app.name}:\`, error.message);
    }
  }
  
  await client.close();
  console.log('\\nSchema Registry initialized successfully!');
}

init().catch(console.error);
`;
  
  await fs.writeFile(initScriptPath, script);
  await fs.chmod(initScriptPath, '755');
  console.log('✓ Created initialization script');
}

async function main() {
  console.log('Starting Schema Registry migration...\n');
  
  try {
    await updateServerFile();
    await updateToolsIndex();
    await createDataDirectory();
    await updateGitignore();
    await createInitScript();
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npm install sqlite3 sqlite');
    console.log('2. Build: npm run build');
    console.log('3. Initialize: node init-schema-registry.js');
    console.log('4. Start server: npm start');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
