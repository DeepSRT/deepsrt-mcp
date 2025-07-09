#!/usr/bin/env node
/**
 * Unified DeepSRT Entry Point
 * Handles both MCP server mode and CLI commands
 * 
 * Usage:
 *   bunx @deepsrt/deepsrt-mcp [--server]                 # Run MCP server (default)
 *   bunx @deepsrt/deepsrt-mcp get-transcript <video-url> # CLI transcript
 *   bunx @deepsrt/deepsrt-mcp get-summary <video-url>    # CLI summary
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { VERSION } from './version.js';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Default to server mode when no arguments
    await runMCPServer();
  } else if (args[0] === '--server') {
    // Explicit server mode
    await runMCPServer();
  } else if (args[0] === 'get-transcript' || args[0] === 'get-summary') {
    // CLI mode
    runCLI(args);
  } else if (args[0] === '--help' || args[0] === '-h') {
    // Show help
    showHelp();
  } else {
    console.error(`❌ Unknown command: ${args[0]}`);
    console.error(`Run 'bunx @deepsrt/deepsrt-mcp --help' for usage information.`);
    process.exit(1);
  }
}

async function runMCPServer() {
  try {
    // Import and run the MCP server by importing the module
    // The server starts automatically when the module is imported
    await import('./index.js');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

function runCLI(args: string[]) {
  // Run the CLI with the provided arguments
  const cliPath = join(__dirname, 'cli.js');
  
  const child = spawn('node', [cliPath, ...args], {
    stdio: 'inherit'
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
  
  child.on('error', (error) => {
    console.error('Failed to start CLI:', error);
    process.exit(1);
  });
}

function showHelp() {
  console.log(`🚀 DeepSRT MCP Tool v${VERSION}\n`);
  console.log(`Usage:`);
  console.log(`  bunx @deepsrt/deepsrt-mcp [--server]                         # Run MCP server (default)`);
  console.log(`  bunx @deepsrt/deepsrt-mcp get-transcript <video-url> [opts]  # Extract transcript`);
  console.log(`  bunx @deepsrt/deepsrt-mcp get-summary <video-url> [opts]     # Generate summary\n`);
  console.log(`MCP Server Mode:`);
  console.log(`  --server          Start MCP server for Claude Desktop/Cline integration`);
  console.log(`                    (This is the default mode when no arguments provided)\n`);
  console.log(`CLI Commands:`);
  console.log(`  get-transcript    Extract transcript with timestamps`);
  console.log(`  get-summary       Generate video summary\n`);
  console.log(`CLI Options:`);
  console.log(`  --lang=<lang>     Target language (default: en for transcript, zh-tw for summary)`);
  console.log(`  --mode=<mode>     Summary mode: narrative|bullet (default: narrative)\n`);
  console.log(`Examples:`);
  console.log(`  # MCP Server (for Claude Desktop/Cline)`);
  console.log(`  bunx @deepsrt/deepsrt-mcp`);
  console.log(`  bunx @deepsrt/deepsrt-mcp --server\n`);
  console.log(`  # CLI Usage`);
  console.log(`  bunx @deepsrt/deepsrt-mcp get-transcript https://www.youtube.com/watch?v=dQw4w9WgXcQ`);
  console.log(`  bunx @deepsrt/deepsrt-mcp get-transcript dQw4w9WgXcQ --lang=en`);
  console.log(`  bunx @deepsrt/deepsrt-mcp get-summary dQw4w9WgXcQ --lang=zh-tw --mode=bullet`);
  console.log(`  bunx @deepsrt/deepsrt-mcp get-summary https://youtu.be/dQw4w9WgXcQ --lang=ja\n`);
  console.log(`  # Global Installation`);
  console.log(`  npm install -g @deepsrt/deepsrt-mcp`);
  console.log(`  deepsrt-mcp get-transcript dQw4w9WgXcQ --lang=en`);
  
  process.exit(0);
}

// Run main function
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
