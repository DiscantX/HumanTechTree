const fs = require('fs');
const path = require('path');

const docsDir = path.resolve('..', 'terminus-db_official_docs');

function walk(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walk(filePath, fileList);
      } else if (filePath.endsWith('.md') || filePath.endsWith('.mdx') || filePath.endsWith('.txt') || filePath.endsWith('.yaml') || filePath.endsWith('.json')) {
        fileList.push(filePath);
      }
    } catch (e) {}
  });
  return fileList;
}

const files = walk(docsDir);
console.log(`Found ${files.length} files in docs clone.`);

const searchTerms = ['rebase', 'replayed', 'replay', 'target', 'conflict', 'schema', 'integrity', 'validation', 'check'];
const hits = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const lower = line.toLowerCase();
    // Check if line mentions rebase/replayed/replay AND check/validate/schema/integrity/conflict/target
    const hasRebase = lower.includes('rebase') || lower.includes('replay') || lower.includes('replayed');
    const hasCheck = lower.includes('check') || lower.includes('validat') || lower.includes('integrity') || lower.includes('conflict') || lower.includes('state');
    if (hasRebase && hasCheck) {
      hits.push({
        file: path.relative(path.resolve('..'), file),
        line: idx + 1,
        content: line.trim()
      });
    }
  });
});

console.log('--- Search Results ---');
if (hits.length === 0) {
  console.log('no hits');
  console.log('Search terms used:', searchTerms);
} else {
  hits.forEach(h => {
    console.log(`${h.file}:${h.line} -> ${h.content}`);
  });
}
