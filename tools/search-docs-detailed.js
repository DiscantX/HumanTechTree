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
      } else if (filePath.endsWith('.md') || filePath.endsWith('.mdx')) {
        fileList.push(filePath);
      }
    } catch (e) {}
  });
  return fileList;
}

const files = walk(docsDir);
const hits = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const lower = line.toLowerCase();
    if (lower.includes('rebase') || lower.includes('replay') || lower.includes('merge')) {
      hits.push({
        file: path.relative(path.resolve('..'), file),
        line: idx + 1,
        content: line.trim()
      });
    }
  });
});

console.log(`Found ${hits.length} matching lines across docs.`);
hits.forEach(h => {
  console.log(`${h.file}:${h.line} -> ${h.content}`);
});
