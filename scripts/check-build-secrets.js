// Pre-deploy check: fail if the build output contains a real-looking Anthropic key.
const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(__dirname, '..', process.argv[2] || 'build');
const pattern = /sk-ant-[A-Za-z0-9_-]{20,}/;

if (!fs.existsSync(buildDir)) {
  console.error(`check-build-secrets: build folder not found: ${buildDir}`);
  process.exit(1);
}

const hits = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (pattern.test(fs.readFileSync(full, 'latin1'))) hits.push(path.relative(buildDir, full));
  }
})(buildDir);

if (hits.length) {
  console.error('check-build-secrets: key-like string found in build output (contents not shown):');
  hits.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log(`check-build-secrets: OK, no key-like strings in ${path.basename(buildDir)}/`);
