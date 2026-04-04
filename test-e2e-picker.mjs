/**
 * Test script to verify workspace picker E2E scenario
 * Run: node test-e2e-picker.mjs
 */

import { WorkspaceResolver } from './dist/index.js';

// Test with the actual REPO_ROOT_DIR
const repoRootDir = process.env.REPO_ROOT_DIR || '~/git';

console.log('Testing workspace picker E2E scenario...');
console.log('REPO_ROOT_DIR:', repoRootDir);

const resolver = new WorkspaceResolver({
  repoRootDir,
  scanDepth: 2,
});

// List all discovered repos
const repos = resolver.listRepos();
console.log(`\nDiscovered ${repos.length} repos:`);
repos.forEach((r) => console.log(`  - ${r.id}`));

// Test resolution with the E2E message text
const messageText =
  '<@U0AQEJ7E96K> LIVE_E2E_PICKER b47e26ea-951d-42b0-adee-c126ef14e6fd Please work on e2e-picker-b47e26ea.';
console.log(`\nTesting resolution for message: "${messageText}"`);

const resolution = resolver.resolveFromText(messageText, 'auto');
console.log('\nResolution result:');
console.log('  Status:', resolution.status);

if (resolution.status === 'ambiguous') {
  console.log('  Reason:', resolution.reason);
  console.log('  Query:', resolution.query);
  console.log('  Candidates:');
  resolution.candidates.forEach((c, i) => {
    console.log(`    ${i + 1}. ${c.id} (${c.repoPath})`);
  });
} else if (resolution.status === 'unique') {
  console.log('  Workspace:', resolution.workspace.workspaceLabel);
  console.log('  Path:', resolution.workspace.workspacePath);
} else {
  console.log('  Reason:', resolution.reason);
}

// Check if e2e-picker repos exist
const e2eRepos = repos.filter((r) => r.id.includes('e2e-picker'));
console.log(`\nFound ${e2eRepos.length} e2e-picker repos:`);
e2eRepos.forEach((r) => console.log(`  - ${r.id}: ${r.repoPath}`));

if (e2eRepos.length >= 2) {
  console.log('\n✅ E2E test prerequisites met: Multiple e2e-picker repos found');
  console.log(
    '   The bot should show a workspace picker when mentioned with "e2e-picker-b47e26ea"',
  );
} else {
  console.log('\n⚠️  E2E test prerequisites NOT met:');
  console.log('   Need 2+ repos named "e2e-picker-b47e26ea" in different parent directories');
  console.log('   Current REPO_ROOT_DIR:', repoRootDir);
}
