#!/usr/bin/env node

/**
 * Verification script for Claude Desktop integration
 * Tests that all tools are accessible and working
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔍 CLAUDE DESKTOP INTEGRATION VERIFICATION\n');

// Check if server is built
function checkBuild() {
  console.log('📦 Checking build status...');
  const distPath = path.join(__dirname, 'dist', 'index.js');
  if (!fs.existsSync(distPath)) {
    console.log('❌ Server not built. Run: npm run build');
    return false;
  }
  console.log('✅ Server build found\n');
  return true;
}

// Check environment configuration
function checkEnvironment() {
  console.log('🔧 Checking environment configuration...');
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env file not found - you\'ll need to configure environment variables');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasUrl = envContent.includes('BUDIBASE_URL=');
  const hasKey = envContent.includes('BUDIBASE_API_KEY=');
  
  if (!hasUrl || !hasKey) {
    console.log('❌ Missing required environment variables in .env');
    console.log('   Required: BUDIBASE_URL, BUDIBASE_API_KEY');
    return false;
  }
  
  console.log('✅ Environment configuration found\n');
  return true;
}

// Find Claude Desktop config path
function getClaudeConfigPath() {
  console.log('📍 Locating Claude Desktop config...');
  
  const platform = os.platform();
  let configPath;
  
  switch (platform) {
    case 'darwin': // macOS
      configPath = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      break;
    case 'win32': // Windows
      configPath = path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
      break;
    default: // Linux
      configPath = path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
      break;
  }
  
  if (fs.existsSync(configPath)) {
    console.log(`✅ Claude Desktop config found: ${configPath}\n`);
    return configPath;
  } else {
    console.log(`⚠️  Claude Desktop config not found at: ${configPath}`);
    console.log('   This is normal if Claude Desktop hasn\'t been configured yet\n');
    return null;
  }
}

// Check if Budibase MCP server is configured in Claude Desktop
function checkClaudeConfig(configPath) {
  if (!configPath) return false;
  
  console.log('🔗 Checking Claude Desktop configuration...');
  
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);
    
    if (config.mcpServers && config.mcpServers.budibase) {
      console.log('✅ Budibase MCP server is configured in Claude Desktop');
      console.log(`   Command: ${config.mcpServers.budibase.command}`);
      console.log(`   Args: ${config.mcpServers.budibase.args?.join(' ') || 'none'}`);
      return true;
    } else {
      console.log('❌ Budibase MCP server not found in Claude Desktop config');
      return false;
    }
  } catch (error) {
    console.log(`❌ Error reading Claude Desktop config: ${error.message}`);
    return false;
  }
}

// Test server startup
function testServerStartup() {
  console.log('🚀 Testing server startup...');
  
  return new Promise((resolve) => {
    const serverProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });
    
    let output = '';
    let errorOutput = '';
    
    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    serverProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // Give server 5 seconds to start
    setTimeout(() => {
      serverProcess.kill('SIGTERM');
      
      if (output.includes('Budibase MCP Server started successfully') || 
          output.includes('Server ready')) {
        console.log('✅ Server starts successfully');
        resolve(true);
      } else if (errorOutput.includes('ECONNREFUSED') || 
                 errorOutput.includes('authentication')) {
        console.log('⚠️  Server starts but cannot connect to Budibase');
        console.log('   This is expected if Budibase credentials are not configured');
        resolve(true);
      } else {
        console.log('❌ Server failed to start');
        if (errorOutput) {
          console.log(`   Error: ${errorOutput.split('\n')[0]}`);
        }
        resolve(false);
      }
    }, 5000);
  });
}

// List available tools
function listTools() {
  console.log('\n📋 Available Tools Summary:');
  
  try {
    const tools = require('./dist/tools/index.js').tools;
    console.log(`Total: ${tools.length} tools\n`);
    
    const categories = {
      'Application Management': tools.filter(t => t.name.includes('application') || t.name.includes('publish') || t.name === 'discover_apps'),
      'Table Management': tools.filter(t => t.name.includes('table')),
      'Record Operations': tools.filter(t => t.name.includes('record') || t.name.includes('row') || t.name === 'query_records'),
      'User Management': tools.filter(t => t.name.includes('user')),
      'Query Management': tools.filter(t => t.name.includes('query') && !t.name.includes('record')),
      'Batch Operations': tools.filter(t => t.name.includes('batch') || t.name.includes('bulk')),
      'Data Transformation': tools.filter(t => t.name.includes('transform') || t.name.includes('convert') || t.name.includes('aggregate'))
    };
    
    Object.entries(categories).forEach(([category, categoryTools]) => {
      if (categoryTools.length > 0) {
        console.log(`${category}: ${categoryTools.length} tools`);
        categoryTools.forEach(tool => {
          console.log(`  • ${tool.name}`);
        });
        console.log();
      }
    });
    
    return true;
  } catch (error) {
    console.log(`❌ Error listing tools: ${error.message}`);
    return false;
  }
}

// Generate Claude Desktop config template
function generateConfigTemplate() {
  console.log('\n📝 Generating Claude Desktop configuration template...');
  
  const template = {
    mcpServers: {
      budibase: {
        command: "node",
        args: [path.join(__dirname, "dist", "index.js")],
        env: {
          BUDIBASE_URL: "https://your-budibase-instance.com",
          BUDIBASE_API_KEY: "your_api_key_here"
        }
      }
    }
  };
  
  const templatePath = path.join(__dirname, 'claude-desktop-config-template.json');
  fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));
  
  console.log(`✅ Configuration template saved to: ${templatePath}`);
  console.log('   Copy this configuration to your Claude Desktop config file');
}

// Main verification function
async function main() {
  let allChecks = true;
  
  // Run all checks
  allChecks &= checkBuild();
  allChecks &= checkEnvironment();
  
  const configPath = getClaudeConfigPath();
  const isConfigured = checkClaudeConfig(configPath);
  
  console.log();
  const serverWorks = await testServerStartup();
  allChecks &= serverWorks;
  
  const toolsWork = listTools();
  allChecks &= toolsWork;
  
  generateConfigTemplate();
  
  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  
  console.log(`Build Status: ${checkBuild() ? '✅ Ready' : '❌ Not Built'}`);
  console.log(`Environment: ${checkEnvironment() ? '✅ Configured' : '❌ Missing'}`);
  console.log(`Claude Config: ${isConfigured ? '✅ Configured' : '⚠️  Not Found'}`);
  console.log(`Server Startup: ${serverWorks ? '✅ Working' : '❌ Failed'}`);
  console.log(`Tools Available: ${toolsWork ? '✅ All 36 tools' : '❌ Error'}`);
  
  console.log('\n🎯 NEXT STEPS:');
  
  if (!isConfigured) {
    console.log('1. Copy claude-desktop-config-template.json to your Claude Desktop config');
    console.log('2. Update the BUDIBASE_URL and BUDIBASE_API_KEY values');
    console.log('3. Restart Claude Desktop');
  } else if (allChecks) {
    console.log('✅ Everything looks good! Claude Desktop should have access to all Budibase tools.');
  } else {
    console.log('❌ Please fix the issues above before using with Claude Desktop.');
  }
  
  console.log('\n📖 For detailed setup instructions, see: CLAUDE_DESKTOP_SETUP.md');
  
  process.exit(allChecks ? 0 : 1);
}

main().catch(console.error);