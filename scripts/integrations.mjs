#!/usr/bin/env node

import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { createIntegrationManager, SUPPORTED_INTEGRATIONS } = require('../electron/integration-manager.cjs');
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manager = createIntegrationManager({ sourceRoot: resolve(repositoryRoot, 'integrations') });
const [command = 'status', integrationId] = process.argv.slice(2);

function printIntegrations(integrations) {
  for (const integration of integrations) {
    const detection = integration.detected ? 'detected' : 'not detected';
    console.log(`${integration.name}: ${integration.status} (${detection})`);
    if (integration.detail) console.log(`  ${integration.detail}`);
    if (integration.note) console.log(`  ${integration.note}`);
  }
}

try {
  if (integrationId && !SUPPORTED_INTEGRATIONS.includes(integrationId)) {
    throw new Error(`Unknown integration "${integrationId}". Use: ${SUPPORTED_INTEGRATIONS.join(', ')}`);
  }

  if (command === 'status') {
    printIntegrations(manager.list());
  } else if (command === 'install') {
    const results = integrationId
      ? [manager.install(integrationId)]
      : manager.installAll({ detectedOnly: true });
    if (results.length === 0) console.log('No supported agent CLIs were detected.');
    else printIntegrations(results);
  } else if (command === 'uninstall') {
    printIntegrations(integrationId ? [manager.uninstall(integrationId)] : manager.uninstallAll());
  } else if (command === 'doctor') {
    const result = manager.doctor();
    printIntegrations(result.integrations);
    if (result.issues.length > 0) {
      console.error('\nIssues:');
      for (const issue of result.issues) console.error(`- ${issue}`);
      process.exitCode = 1;
    } else {
      console.log('\nIntegration files and configurations are healthy.');
    }
  } else {
    throw new Error('Usage: integrations.mjs <status|install|uninstall|doctor> [pi|claude-code|codex]');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
