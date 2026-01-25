#!/usr/bin/env node

/**
 * Validate agent configuration file
 * Usage: node scripts/validate-agent-config.js
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../.sisyphus/agent-config.json');
const SCHEMA_PATH = path.join(__dirname, '../.sisyphus/agent-config.schema.json');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function validateConfig() {
  log('\n🔍 Validating Agent Configuration...', 'cyan');
  
  // Check if files exist
  if (!fs.existsSync(CONFIG_PATH)) {
    log(`❌ Config file not found: ${CONFIG_PATH}`, 'red');
    process.exit(1);
  }
  
  if (!fs.existsSync(SCHEMA_PATH)) {
    log(`⚠️  Schema file not found: ${SCHEMA_PATH}`, 'yellow');
    log('   Skipping schema validation', 'yellow');
  }
  
  // Parse config
  let config;
  try {
    const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    config = JSON.parse(configContent);
    log('✅ Valid JSON syntax', 'green');
  } catch (error) {
    log(`❌ Invalid JSON: ${error.message}`, 'red');
    process.exit(1);
  }
  
  // Validate structure
  const errors = [];
  const warnings = [];
  
  // Check required fields
  if (!config.version) errors.push('Missing required field: version');
  if (!config.agents) errors.push('Missing required field: agents');
  if (!config.categories) errors.push('Missing required field: categories');
  
  // Validate agents
  if (config.agents) {
    Object.entries(config.agents).forEach(([name, agentConfig]) => {
      if (!agentConfig.model) {
        errors.push(`Agent "${name}": missing model`);
      } else if (!agentConfig.model.startsWith('claude-')) {
        errors.push(`Agent "${name}": invalid model format (must start with "claude-")`);
      }
      
      if (agentConfig.temperature === undefined) {
        errors.push(`Agent "${name}": missing temperature`);
      } else if (agentConfig.temperature < 0 || agentConfig.temperature > 1) {
        errors.push(`Agent "${name}": temperature must be between 0 and 1`);
      }
      
      if (!agentConfig.description) {
        warnings.push(`Agent "${name}": missing description`);
      }
      
      if (!agentConfig.reasoning) {
        warnings.push(`Agent "${name}": missing reasoning`);
      }
    });
  }
  
  // Validate categories
  if (config.categories) {
    Object.entries(config.categories).forEach(([name, categoryConfig]) => {
      if (!categoryConfig.model) {
        errors.push(`Category "${name}": missing model`);
      }
      
      if (categoryConfig.temperature === undefined) {
        errors.push(`Category "${name}": missing temperature`);
      } else if (categoryConfig.temperature < 0 || categoryConfig.temperature > 1) {
        errors.push(`Category "${name}": temperature must be between 0 and 1`);
      }
      
      if (!categoryConfig.spawns) {
        warnings.push(`Category "${name}": missing spawns field`);
      }
    });
  }
  
  // Validate skills
  if (config.skills) {
    Object.entries(config.skills).forEach(([name, skillConfig]) => {
      if (skillConfig.temperatureAdjustment !== undefined) {
        if (skillConfig.temperatureAdjustment < -0.5 || skillConfig.temperatureAdjustment > 0.5) {
          errors.push(`Skill "${name}": temperatureAdjustment must be between -0.5 and 0.5`);
        }
      }
      
      if (skillConfig.modelOverride && !skillConfig.modelOverride.startsWith('claude-')) {
        errors.push(`Skill "${name}": invalid modelOverride format`);
      }
    });
  }
  
  // Check for Opus usage (cost warning)
  const opusAgents = [];
  if (config.agents) {
    Object.entries(config.agents).forEach(([name, agentConfig]) => {
      if (agentConfig.model.includes('opus')) {
        opusAgents.push(name);
      }
    });
  }
  if (config.categories) {
    Object.entries(config.categories).forEach(([name, categoryConfig]) => {
      if (categoryConfig.model.includes('opus')) {
        opusAgents.push(`category:${name}`);
      }
    });
  }
  
  if (opusAgents.length > 0) {
    warnings.push(`Opus model used in: ${opusAgents.join(', ')} (high cost)`);
  }
  
  // Report results
  log('\n📊 Validation Results:', 'blue');
  
  if (errors.length > 0) {
    log(`\n❌ ${errors.length} Error(s):`, 'red');
    errors.forEach(err => log(`   • ${err}`, 'red'));
  }
  
  if (warnings.length > 0) {
    log(`\n⚠️  ${warnings.length} Warning(s):`, 'yellow');
    warnings.forEach(warn => log(`   • ${warn}`, 'yellow'));
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    log('\n✅ Configuration is valid!', 'green');
  }
  
  // Summary statistics
  log('\n📈 Configuration Summary:', 'cyan');
  log(`   Agents: ${Object.keys(config.agents || {}).length}`, 'cyan');
  log(`   Categories: ${Object.keys(config.categories || {}).length}`, 'cyan');
  log(`   Skills: ${Object.keys(config.skills || {}).length}`, 'cyan');
  
  // Model distribution
  const modelCounts = {};
  Object.values(config.agents || {}).forEach(a => {
    modelCounts[a.model] = (modelCounts[a.model] || 0) + 1;
  });
  Object.values(config.categories || {}).forEach(c => {
    modelCounts[c.model] = (modelCounts[c.model] || 0) + 1;
  });
  
  log('\n🤖 Model Distribution:', 'cyan');
  Object.entries(modelCounts).forEach(([model, count]) => {
    const modelType = model.includes('opus') ? '💎' : model.includes('sonnet') ? '⚡' : '🚀';
    log(`   ${modelType} ${model}: ${count}`, 'cyan');
  });
  
  log(''); // Empty line
  
  // Exit with error code if validation failed
  if (errors.length > 0) {
    process.exit(1);
  }
}

// Run validation
validateConfig();
