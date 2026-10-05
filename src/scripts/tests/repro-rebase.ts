import { config } from '../../config';
import { createClient } from '../../db/client';
import { rebaseBranch } from '../../db/rebase';
import axios from 'axios';

async function runRepros() {
  console.log('--- Upstream Bug Report Repros (Section 1, 2, 3) ---');
  const client = createClient();
  client.db(config.db);

  const getStatus = async (fn: () => Promise<any>): Promise<number> => {
    try {
      await fn();
      return 200;
    } catch (err: any) {
      return err.status ?? err.response?.status ?? err.response?.statusCode ?? 500;
    }
  };

  // --- Section 1: Back-to-back rebase without wait (20 cycles) ---
  console.log('\n--- Section 1: Back-to-back Rebase ---');
  const s1Statuses: number[] = [];
  const N1 = 20;
  for (let i = 0; i < N1; i++) {
    const b1 = `repro_1_b1_${Date.now()}_${i}`;
    const b2 = `repro_1_b2_${Date.now()}_${i}`;
    try {
      client.checkout('main');
      await client.branch(b1);
      client.checkout(b1);
      await client.addDocument({ '@type': 'Node', subject: `S1 B1 ${i}`, category: 'Invention' });

      client.checkout('main');
      await client.branch(b2);
      client.checkout(b2);
      await client.addDocument({ '@type': 'Node', subject: `S1 B2 ${i}`, category: 'Invention' });

      const status1 = await getStatus(() => rebaseBranch({ sourceBranch: b1, targetBranch: 'main', message: `rebase ${b1}` }));
      s1Statuses.push(status1);
      console.log(`Section 1 [${i+1}/${N1}] rebase ${b1} -> main: HTTP ${status1}`);

      const status2 = await getStatus(() => rebaseBranch({ sourceBranch: b2, targetBranch: 'main', message: `rebase ${b2}` }));
      s1Statuses.push(status2);
      console.log(`Section 1 [${i+1}/${N1}] rebase ${b2} -> main: HTTP ${status2}`);
    } catch (e: any) {
      console.error(`Section 1 iteration ${i} error:`, e.message);
    } finally {
      client.checkout('main');
      try { await client.deleteBranch(b1); } catch {}
      try { await client.deleteBranch(b2); } catch {}
    }
  }

  const s1Counts = s1Statuses.reduce((acc: Record<number, number>, st) => {
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});
  console.log('Section 1 Statuses:', s1Statuses);
  console.log('Section 1 Counts:', s1Counts);

  // --- Section 2: Parallel rebases onto main (5 branches) ---
  console.log('\n--- Section 2: Parallel Rebases ---');
  const bList: string[] = [];
  for (let j = 0; j < 5; j++) {
    bList.push(`repro_2_b${j}_${Date.now()}`);
  }
  
  try {
    for (const b of bList) {
      client.checkout('main');
      await client.branch(b);
      client.checkout(b);
      await client.addDocument({ '@type': 'Node', subject: `S2 ${b}`, category: 'Invention' });
    }
    client.checkout('main');

    console.log('Firing 5 parallel rebase calls onto main...');
    const pResults = await Promise.all(
      bList.map(async (b) => {
        const st = await getStatus(() => rebaseBranch({ sourceBranch: b, targetBranch: 'main', message: `parallel rebase ${b}` }));
        console.log(`Section 2 rebase ${b} -> main: HTTP ${st}`);
        return st;
      })
    );

    const s2Counts = pResults.reduce((acc: Record<number, number>, st) => {
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    }, {});
    console.log('Section 2 Statuses:', pResults);
    console.log('Section 2 Counts:', s2Counts);

  } finally {
    client.checkout('main');
    for (const b of bList) {
      try { await client.deleteBranch(b); } catch {}
    }
  }

  // --- Section 3: Missing branch (GET log and rebase) ---
  console.log('\n--- Section 3: Missing Branch ---');
  const s3Statuses: number[] = [];
  const missingBranch = `does_not_exist_${Date.now()}`;

  const logUrl = `${config.endpoint}/api/log/${config.organization}/${config.db}/local/branch/${missingBranch}`;
  const logRes = await axios.get(logUrl, {
    auth: { username: config.user, password: config.key },
    validateStatus: () => true,
  });
  s3Statuses.push(logRes.status);
  console.log(`Section 3 GET log missing branch: HTTP ${logRes.status}, body:`, JSON.stringify(logRes.data));

  const rebaseMissingStatus = await getStatus(() => rebaseBranch({ sourceBranch: missingBranch, targetBranch: 'main', message: 'rebase missing' }));
  s3Statuses.push(rebaseMissingStatus);
  console.log(`Section 3 rebase from missing branch -> main: HTTP ${rebaseMissingStatus}`);

  const s3Counts = s3Statuses.reduce((acc: Record<number, number>, st) => {
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});
  console.log('Section 3 Statuses:', s3Statuses);
  console.log('Section 3 Counts:', s3Counts);

  console.log('\n--- Repro Suite Complete ---');
}

runRepros().catch((err) => {
  console.error('Repro suite failed:', err);
  process.exit(1);
});
