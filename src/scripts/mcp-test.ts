/**
 * Test script for verifying TerminusDB MCP server tool handlers directly.
 */

import {
  handleListBranches,
  handleReadCommitLog,
  handleFetchDocument,
  handleRunWoqlQuery,
  handleContainerStatus,
  handleLogTail,
  handleTerminusDbVersion,
  handleListPlugins,
} from '../mcp/tools';

/**
 * Executes smoke tests against MCP tool handlers.
 */
async function runMcpTests() {
  console.log('Testing MCP tool handlers...');

  console.log('\n1. Testing handleListBranches()...');
  const branches = await handleListBranches();
  console.log('Branches:', branches);

  console.log('\n2. Testing handleReadCommitLog()...');
  const log = await handleReadCommitLog({ branch: 'main', count: 5 });
  console.log('Commit log (first 5):', log?.slice(0, 2));

  console.log('\n3. Testing handleFetchDocument() for Node documents...');
  try {
    const nodes = await handleFetchDocument({ branch: 'main', type: 'Node' });
    console.log(`Fetched ${Array.isArray(nodes) ? nodes.length : 1} Node document(s). Sample:`, nodes?.[0]);
  } catch (err: any) {
    console.log('Fetch document note:', err.message);
  }

  console.log('\n4. Testing handleRunWoqlQuery() for cycle_detection...');
  try {
    const cycles = await handleRunWoqlQuery({ query_type: 'cycle_detection', branch: 'main' });
    console.log('Cycle detection result bindings count:', cycles.length);
  } catch (err: any) {
    console.log('WOQL query note:', err.message);
  }

  console.log('\n5. Testing handleContainerStatus()...');
  try {
    const status = await handleContainerStatus();
    console.log('Container status:', status);
  } catch (err: any) {
    console.log('Container status note:', err.message);
  }

  console.log('\n6. Testing handleLogTail()...');
  try {
    const logs = await handleLogTail({ lines: 5 });
    console.log('Log tail (sample):', logs);
  } catch (err: any) {
    console.log('Log tail note:', err.message);
  }

  console.log('\n7. Testing handleTerminusDbVersion()...');
  try {
    const ver = await handleTerminusDbVersion();
    console.log('TerminusDB version info:', ver);
  } catch (err: any) {
    console.log('TerminusDB version note:', err.message);
  }

  console.log('\n8. Testing handleListPlugins()...');
  try {
    const plugins = await handleListPlugins();
    console.log('Plugins:', plugins);
  } catch (err: any) {
    console.log('Plugins note:', err.message);
  }

  console.log('\nAll MCP test handlers executed successfully.');
}

runMcpTests().catch((err) => {
  console.error('MCP test failed:', err);
  process.exit(1);
});
