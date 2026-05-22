import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { runDatabaseMigration } from '../lib/migrate-db';

// 1. Read environment variables from .env.local and load them into process.env if present
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

function getPoolConfig() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  
  if (connectionString) {
    console.log('Utilizando Connection String para migração.');
    return {
      connectionString,
      ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon') || process.env.PGHOST?.includes('neon')
        ? { rejectUnauthorized: false }
        : undefined,
    };
  }
  
  console.log('Utilizando variáveis individuais PG/POSTGRES para migração.');
  const host = process.env.PGHOST || process.env.POSTGRES_HOST;
  const user = process.env.PGUSER || process.env.POSTGRES_USER;
  const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
  const database = process.env.PGDATABASE || process.env.POSTGRES_DB;
  const port = parseInt(process.env.PGPORT || process.env.POSTGRES_PORT || '5432', 10);
  
  const isNeon = host?.includes('neon.tech');
  
  return {
    host,
    user,
    password,
    database,
    port,
    ssl: isNeon || process.env.SSL_CERT_DAYS
      ? { rejectUnauthorized: false }
      : undefined,
  };
}

const poolConfig = getPoolConfig();
console.log('Configurações de Banco Carregadas:', {
  host: poolConfig.host || 'Usando Connection String',
  user: poolConfig.user || 'Usando Connection String',
  database: poolConfig.database || 'Usando Connection String',
  ssl: poolConfig.ssl ? 'Habilitado (SSL)' : 'Desabilitado'
});

const pool = new Pool(poolConfig);

async function run() {
  console.log('Iniciando migração via CLI (usando a biblioteca compartilhada)...');
  const result = await runDatabaseMigration(pool);
  
  console.log('\n--- RESULTADO DA MIGRAÇÃO ---');
  if (result.success) {
    console.log('SUCESSO:', result.message);
    console.log('\nNota: Você também pode rodar migrações e seeders de forma programática através da API: POST /api/db/migrate');
    await pool.end();
    process.exit(0);
  } else {
    console.error('FALHA:', result.message);
    await pool.end();
    process.exit(1);
  }
}

run().catch(async (err) => {
  console.error('Erro fatal inesperado durante a migração:', err);
  await pool.end();
  process.exit(1);
});
