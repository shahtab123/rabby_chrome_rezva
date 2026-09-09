const fs = require('fs');
const path = require('path');

const MANIFEST_TYPE = process.env.MANIFEST_TYPE || 'chrome-mv3';
const distDir = MANIFEST_TYPE.endsWith('-mv2')
  ? path.join(__dirname, '..', 'dist-mv2')
  : path.join(__dirname, '..', 'dist');

function rmRecursive(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

try {
  if (fs.existsSync(distDir)) {
    rmRecursive(distDir);
  }
  fs.mkdirSync(distDir, { recursive: true });
  console.log(`[rabby] cleaned ${path.basename(distDir)}`);
} catch (error) {
  console.error(`clean failed: ${error}`);
  process.exit(1);
}
