// Pre-deploy check: fail if the build output contains an Anthropic key prefix.
const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(__dirname, '..', process.argv[2] || 'build');
const needle = 'sk-ant';

if (!fs.existsSync(buildDir)) {
  console.error(`check-build-secrets: build folder not found: ${buildDir}`);
  process.exit(1);
}

const hits = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (fs.readFileSync(full).includes(needle)) hits.push(path.relative(buildDir, full));
  }
})(buildDir);

if (hits.length) {
  console.error(`check-build-secrets: "${needle}" found in build output (contents not shown):`);
  hits.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log(`check-build-secrets: OK, no "${needle}" in ${path.basename(buildDir)}/`);
