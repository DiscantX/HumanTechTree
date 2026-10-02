const fs = require('fs');
const path = require('path');

function getMdFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.roo' && file !== 'storage' && file !== 'snapshots') {
        getMdFiles(filePath, fileList);
      }
    } else if (filePath.endsWith('.md')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

// 1. Move upstream-bug-report.md
const oldBugReport = path.join('wiki', 'tech', 'upstream-bug-report.md');
const newBugReport = path.join('docs', 'upstream-bug-report.md');
if (fs.existsSync(oldBugReport)) {
  if (!fs.existsSync('docs')) {
    fs.mkdirSync('docs', { recursive: true });
  }
  fs.writeFileSync(newBugReport, fs.readFileSync(oldBugReport));
  fs.unlinkSync(oldBugReport);
  console.log(`Moved ${oldBugReport} to ${newBugReport}`);
}

const mdFiles = getMdFiles('.');
let totalViolations = { MD009: 0, MD012: 0, MD022: 0 };

mdFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  
  // Remove trailing whitespace from every line, including after **Status:**
  const cleanedLines = lines.map(line => line.replace(/[ \t]+$/, ''));
  
  // Lint checks on cleanedLines
  let md009 = 0;
  let md012 = 0;
  let md022 = 0;

  // MD009: Trailing spaces (should be 0 after cleaning)
  lines.forEach((line, idx) => {
    if (/[ \t]+$/.test(line)) {
      md009++;
    }
  });

  // MD012: Multiple consecutive blank lines
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].trim() === '' && lines[i+1].trim() === '') {
      md012++;
    }
  }

  // MD022: Headings should be surrounded by blank lines
  lines.forEach((line, idx) => {
    if (/^#+\s/.test(line)) {
      if (idx > 0 && lines[idx - 1].trim() !== '') {
        md022++;
      }
      if (idx < lines.length - 1 && lines[idx + 1].trim() !== '') {
        md022++;
      }
    }
  });

  totalViolations.MD009 += md009;
  totalViolations.MD012 += md012;
  totalViolations.MD022 += md022;

  console.log(`File: ${file} | MD009 (before): ${md009}, MD012: ${md012}, MD022: ${md022}`);

  fs.writeFileSync(file, cleanedLines.join('\n'), 'utf8');
});

console.log('\nMarkdown Lint Report Summary:');
console.log(`MD009 (Trailing spaces cleaned): ${totalViolations.MD009}`);
console.log(`MD012 (Multiple consecutive blank lines): ${totalViolations.MD012}`);
console.log(`MD022 (Headings missing blank lines): ${totalViolations.MD022}`);
