/**
 * Permanent test suite for verified backlog feature enhancements in the data layer.
 *
 * Verifies WOQL AST query building contracts for server-side graph algorithms
 * and inspects branch preflight helper functions.
 */

import { branchExists, getCommitLog } from '../db/log';
import { cycleDetectionQuery, blastRadiusQuery } from '../db/woql-queries';
import axios from 'axios';

let failures = 0;

/**
 * Asserts that a condition is true and logs the status to the console.
 *
 * Args:
 *     name: Description of the assertion.
 *     ok: Boolean condition to evaluate.
 *     detail: Optional message to print alongside failures or passes.
 */
const check = (name: string, ok: boolean, detail = ''): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};

console.log('--- TerminusDB Enhanced Backlog Features Test Suite ---\n');

// 1. Validate WOQL Cycle Detection AST Creation
try {
  const cycleQuery = cycleDetectionQuery();
  check(
    'cycleDetectionQuery() compiles successfully',
    Boolean(cycleQuery && typeof cycleQuery.json === 'function'),
  );

  const cycleJson = cycleQuery.json();
  check(
    'cycleDetectionQuery() contains valid @type logic operators',
    cycleJson['@type'] === 'Value' || cycleJson['@type'] === 'And' || Array.isArray(cycleJson['and']),
  );
} catch (err: any) {
  check('cycleDetectionQuery() execution failed during AST building', false, err.message);
}

// 2. Validate WOQL Blast Radius AST Creation
try {
  const testNode = 'terminusdb:///data/Node/test_root_concept';
  const blastQuery = blastRadiusQuery(testNode);
  check(
    'blastRadiusQuery() compiles successfully',
    Boolean(blastQuery && typeof blastQuery.json === 'function'),
  );

  const blastJson = blastQuery.json();
  check(
    'blastRadiusQuery() distinct selects descendant variable',
    JSON.stringify(blastJson).includes('Descendant'),
  );
} catch (err: any) {
  check('blastRadiusQuery() execution failed during AST building', false, err.message);
}

// 3. Validate Helper Types and SDK Contracts
check(
  'branchExists() helper is exported and reachable',
  typeof branchExists === 'function',
);

check(
  'getCommitLog() pagination helper is exported and reachable',
  typeof getCommitLog === 'function',
);

// 4. Validate branchExists error handling offline
async function testBranchExistsOffline() {
  const originalGet = axios.get;
  try {
    (axios.get as any) = async () => ({ status: 200, data: { branches: ['main', 'feat'] } });
    check('branchExists returns true on 200 when branch present', await branchExists('feat') === true);

    (axios.get as any) = async () => ({ status: 200, data: { branches: ['main'] } });
    check('branchExists returns false on 200 when branch absent', await branchExists('feat') === false);

    (axios.get as any) = async () => ({ status: 404, data: {} });
    check('branchExists returns false on 404', await branchExists('feat') === false);

    (axios.get as any) = async () => ({ status: 401, data: {} });
    let threw401 = false;
    try {
      await branchExists('feat');
    } catch (err: any) {
      threw401 = err.message.includes('401');
    }
    check('branchExists throws error including status code on 401', threw401);

    (axios.get as any) = async () => { throw new Error('ECONNREFUSED'); };
    let threwNetwork = false;
    try {
      await branchExists('feat');
    } catch (err: any) {
      threwNetwork = Boolean(err);
    }
    check('branchExists throws error on network error', threwNetwork);
  } finally {
    axios.get = originalGet;
  }
}

testBranchExistsOffline()
  .then(() => {
    console.log('\n--- Test Result Summary ---');
    console.log(failures === 0 ? 'All backlog feature tests passed successfully.' : `${failures} test(s) failed.`);
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
