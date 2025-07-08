#!/usr/bin/env node
/**
 * NPX Wrapper for DeepSRT CLI
 * This script allows direct execution with npx @deepsrt/deepsrt-mcp
 */

// Import and execute the CLI
import('./cli.js').then(module => {
  // The CLI module will execute automatically when imported
}).catch(error => {
  console.error('Error loading CLI:', error);
  process.exit(1);
});
