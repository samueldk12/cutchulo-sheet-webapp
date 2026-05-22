const fs = require('fs');
const path = require('path');

const appJsPath = 'C:\\Users\\samue\\projects\\cutchulo-sheet\\public\\app.js';

if (!fs.existsSync(appJsPath)) {
  console.error('app.js does not exist');
  process.exit(1);
}

const content = fs.readFileSync(appJsPath, 'utf8');

const index = content.indexOf('weapon_catalog');
console.log('Index of weapon_catalog in app.js:', index);
const startIdx = Math.max(0, index - 200);
const endIdx = Math.min(content.length, index + 3000);
console.log('--- Substring ---');
console.log(content.slice(startIdx, endIdx));
console.log('--- End Substring ---');
