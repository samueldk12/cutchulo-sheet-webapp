const { spawnSync } = require('child_process');
const path = require('path');

console.log('Executando migração do banco de dados com tsx...');
const tsScript = path.join(__dirname, 'migrate.ts');

const result = spawnSync('npx', ['-y', 'tsx', tsScript], {
  stdio: 'inherit',
  shell: true
});

process.exit(result.status || 0);
