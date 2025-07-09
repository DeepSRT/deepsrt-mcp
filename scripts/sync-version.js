#!/usr/bin/env node
/**
 * Sync version from package.json to src/version.ts
 * This ensures the version constant stays in sync with package.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const packageJsonPath = join(projectRoot, 'package.json');
const versionTsPath = join(projectRoot, 'src', 'version.ts');

try {
  // Read package.json
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;
  
  if (!version) {
    throw new Error('No version found in package.json');
  }
  
  // Generate version.ts content
  const versionTsContent = `/**
 * Shared version constant for DeepSRT MCP Server
 * This should be the single source of truth for version information
 * 
 * Auto-generated from package.json - do not edit manually
 * Run 'npm run sync-version' to update this file
 */
export const VERSION = '${version}';
`;
  
  // Write version.ts
  writeFileSync(versionTsPath, versionTsContent);
  
  console.log(`✅ Version synced: ${version}`);
  console.log(`   package.json → src/version.ts`);
  
} catch (error) {
  console.error('❌ Failed to sync version:', error.message);
  process.exit(1);
}
