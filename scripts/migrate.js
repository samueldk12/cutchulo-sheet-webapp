const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const initSqlJs = require('sql.js');

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

// 2. Build the database connection pool using robust logic
function getPoolConfig() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  
  if (connectionString) {
    console.log('Utilizando Connection String para migração.');
    return {
      connectionString,
      ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon') || (process.env.PGHOST && process.env.PGHOST.includes('neon'))
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
  
  const isNeon = host && host.includes('neon.tech');
  
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

const SQLITE_DB_PATH = path.join(__dirname, '..', 'data', 'cthulhu.db');

async function runMigration() {
  console.log('--- INICIANDO MIGRAÇÃO DO BANCO DE DADOS (SQLite -> PostgreSQL) ---');
  console.log(`Caminho SQLite: ${SQLITE_DB_PATH}`);

  if (!fs.existsSync(SQLITE_DB_PATH)) {
    console.error(`Erro: Arquivo SQLite não encontrado em ${SQLITE_DB_PATH}`);
    process.exit(1);
  }

  // Initialize SQL.js and parse the database
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(SQLITE_DB_PATH);
  const db = new SQL.Database(fileBuffer);

  // Helper function to query SQLite
  function sqliteQuery(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  // Verify that target tables exist in PG
  console.log('Verificando/inicializando tabelas no PostgreSQL...');
  // We can call pgPool query to see if users exists. Next.js app auto-initializes on query
  // so let's do a simple schema check and run the DDLs if they don't exist yet to be safe
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS characters (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      uuid VARCHAR(36) NOT NULL UNIQUE,
      name VARCHAR(255) DEFAULT 'Novo Investigador',
      player VARCHAR(255) DEFAULT '',
      occupation VARCHAR(255) DEFAULT '',
      age INTEGER DEFAULT 25,
      gender VARCHAR(100) DEFAULT '',
      residence VARCHAR(255) DEFAULT '',
      birthplace VARCHAR(255) DEFAULT '',
      str INTEGER DEFAULT 50,
      dex INTEGER DEFAULT 50,
      int_val INTEGER DEFAULT 50,
      con INTEGER DEFAULT 50,
      app INTEGER DEFAULT 50,
      pow INTEGER DEFAULT 50,
      siz INTEGER DEFAULT 50,
      edu INTEGER DEFAULT 50,
      luck INTEGER DEFAULT 50,
      hp_current INTEGER DEFAULT 10,
      hp_max INTEGER DEFAULT 10,
      mp_current INTEGER DEFAULT 10,
      mp_max INTEGER DEFAULT 10,
      san_current INTEGER DEFAULT 50,
      san_max INTEGER DEFAULT 50,
      temporary_insanity INTEGER DEFAULT 0,
      indefinite_insanity INTEGER DEFAULT 0,
      cash TEXT DEFAULT '',
      assets TEXT DEFAULT '',
      spending_level TEXT DEFAULT '',
      appearance_desc TEXT DEFAULT '',
      ideology TEXT DEFAULT '',
      significant_people TEXT DEFAULT '',
      meaningful_locations TEXT DEFAULT '',
      treasured_possessions TEXT DEFAULT '',
      traits TEXT DEFAULT '',
      injuries_scars TEXT DEFAULT '',
      phobias_manias TEXT DEFAULT '',
      arcane_tomes TEXT DEFAULT '',
      backstory TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      image TEXT DEFAULT '',
      is_friend INTEGER DEFAULT 0,
      shared BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS friends (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, character_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      code VARCHAR(10) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL DEFAULT 'Nova Campanha',
      notes TEXT DEFAULT '',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS session_characters (
      id SERIAL PRIMARY KEY,
      session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
      character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
      UNIQUE(session_id, character_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS skills (
      id SERIAL PRIMARY KEY,
      character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      base_value INTEGER DEFAULT 0,
      value INTEGER DEFAULT 0,
      is_occupation INTEGER DEFAULT 0,
      is_interest INTEGER DEFAULT 0,
      occ_points INTEGER DEFAULT 0,
      int_points INTEGER DEFAULT 0,
      game_points INTEGER DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS weapons (
      id SERIAL PRIMARY KEY,
      character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
      name VARCHAR(255) DEFAULT '',
      skill VARCHAR(255) DEFAULT '',
      damage VARCHAR(255) DEFAULT '',
      range VARCHAR(255) DEFAULT '',
      attacks_per_round VARCHAR(100) DEFAULT '1',
      ammo INTEGER DEFAULT 0,
      malfunction INTEGER DEFAULT 100
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS possessions (
      id SERIAL PRIMARY KEY,
      character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
      item TEXT DEFAULT ''
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dice_history (
      id SERIAL PRIMARY KEY,
      character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
      expression VARCHAR(255) NOT NULL,
      result INTEGER NOT NULL,
      details TEXT DEFAULT '',
      rolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS config (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      key VARCHAR(255) NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, key)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS evidence (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) DEFAULT 'Nova Evidência',
      description TEXT DEFAULT '',
      session_tag VARCHAR(255) DEFAULT '',
      image TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS npcs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) DEFAULT 'Novo NPC',
      type VARCHAR(100) DEFAULT 'npc',
      description TEXT DEFAULT '',
      str INTEGER DEFAULT 50,
      dex INTEGER DEFAULT 50,
      int_val INTEGER DEFAULT 50,
      con INTEGER DEFAULT 50,
      pow INTEGER DEFAULT 50,
      siz INTEGER DEFAULT 50,
      hp_current INTEGER DEFAULT 10,
      hp_max INTEGER DEFAULT 10,
      mp_current INTEGER DEFAULT 10,
      mp_max INTEGER DEFAULT 10,
      san_current INTEGER DEFAULT 50,
      san_max INTEGER DEFAULT 50,
      damage_bonus VARCHAR(100) DEFAULT '',
      build VARCHAR(100) DEFAULT '',
      armor INTEGER DEFAULT 0,
      attacks TEXT DEFAULT '[]',
      skills_text TEXT DEFAULT '',
      special_abilities TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      image TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS weapon_catalog (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL DEFAULT '',
      skill VARCHAR(255) DEFAULT '',
      damage VARCHAR(255) DEFAULT '',
      range VARCHAR(255) DEFAULT '',
      attacks_per_round VARCHAR(100) DEFAULT '1',
      ammo INTEGER DEFAULT 0,
      malfunction INTEGER DEFAULT 100,
      category VARCHAR(100) DEFAULT 'other',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS session_log_entries (
      id SERIAL PRIMARY KEY,
      session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
      content TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pdf_annotations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      page INTEGER DEFAULT 1,
      note TEXT DEFAULT '',
      color VARCHAR(100) DEFAULT 'yellow',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Tabelas PG verificadas e prontas.');

  // 1. Migrate Users
  console.log('Migrando Usuários...');
  const sqliteUsers = sqliteQuery('SELECT * FROM users');
  console.log(`Encontrados ${sqliteUsers.length} usuários no SQLite.`);

  let samuelUserId = null;

  for (const u of sqliteUsers) {
    const exists = await pool.query('SELECT id FROM users WHERE id = $1', [u.id]);
    if (exists.rows.length === 0) {
      await pool.query(
        `INSERT INTO users (id, username, password_hash, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (username) DO NOTHING`,
        [u.id, u.username, u.password_hash, u.created_at || new Date()]
      );
      console.log(`Usuário '${u.username}' (ID SQLite: ${u.id}) importado para PG.`);
    } else {
      console.log(`Usuário '${u.username}' (ID: ${u.id}) já existe no PG.`);
    }

    if (u.username === 'samuel.arao@gmail.com') {
      samuelUserId = u.id;
    }
  }

  // Fallback to find or create "samuel.arao@gmail.com" if not found
  if (!samuelUserId) {
    const checkUser = await pool.query("SELECT id FROM users WHERE username = 'samuel.arao@gmail.com'");
    if (checkUser.rows.length > 0) {
      samuelUserId = checkUser.rows[0].id;
    } else {
      // Create user
      const defaultHash = '$2b$10$vCXeKn.ErfPc5C0xkUda1eCm76xsVdHrpHRNyWH2Ls0tE03y8KyiO'; // exact hash for samuel.arao@gmail.com
      const res = await pool.query(
        "INSERT INTO users (username, password_hash) VALUES ('samuel.arao@gmail.com', $1) RETURNING id",
        [defaultHash]
      );
      samuelUserId = res.rows[0].id;
      console.log(`Usuário padrão 'samuel.arao@gmail.com' criado com ID ${samuelUserId}.`);
    }
  }

  console.log(`ID do Usuário Principal (samuel.arao@gmail.com): ${samuelUserId}`);

  // 2. Migrate Characters (Investigadores)
  console.log('Migrando Personagens...');
  const sqliteChars = sqliteQuery('SELECT * FROM characters');
  console.log(`Encontrados ${sqliteChars.length} personagens no SQLite.`);

  for (const c of sqliteChars) {
    const exists = await pool.query('SELECT id FROM characters WHERE id = $1', [c.id]);
    const uuid = c.uuid || require('crypto').randomUUID();
    
    // In SQLite, they had user_id = 0 or null. We assign them to samuelUserId
    const characterOwnerId = samuelUserId;

    if (exists.rows.length === 0) {
      await pool.query(
        `INSERT INTO characters (
          id, user_id, uuid, name, player, occupation, age, gender, residence, birthplace,
          str, dex, int_val, con, app, pow, siz, edu, luck,
          hp_current, hp_max, mp_current, mp_max, san_current, san_max,
          temporary_insanity, indefinite_insanity, cash, assets, spending_level,
          appearance_desc, ideology, significant_people, meaningful_locations,
          treasured_possessions, traits, injuries_scars, phobias_manias, arcane_tomes,
          backstory, notes, image, is_friend, shared, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46)`,
        [
          c.id, characterOwnerId, uuid, c.name || 'Novo Investigador', c.player || '', c.occupation || '', c.age || 25,
          c.gender || '', c.residence || '', c.birthplace || '', c.str || 50, c.dex || 50, c.int_val || 50, c.con || 50,
          c.app || 50, c.pow || 50, c.siz || 50, c.edu || 50, c.luck || 50, c.hp_current || 10, c.hp_max || 10,
          c.mp_current || 10, c.mp_max || 10, c.san_current || 50, c.san_max || 50, c.temporary_insanity || 0,
          c.indefinite_insanity || 0, c.cash || '', c.assets || '', c.spending_level || '', c.appearance_desc || '',
          c.ideology || '', c.significant_people || '', c.meaningful_locations || '', c.treasured_possessions || '',
          c.traits || '', c.injuries_scars || '', c.phobias_manias || '', c.arcane_tomes || '', c.backstory || '',
          c.notes || '', c.image || '', c.is_friend || 0, c.shared ? true : false, c.created_at || new Date(), c.updated_at || new Date()
        ]
      );
      console.log(`Personagem '${c.name}' (ID SQLite: ${c.id}) importado com sucesso.`);
    } else {
      console.log(`Personagem '${c.name}' (ID: ${c.id}) já existe no PG.`);
    }
  }

  // 3. Migrate Skills
  console.log('Migrando Habilidades de Personagem (Skills)...');
  const sqliteSkills = sqliteQuery('SELECT * FROM skills');
  console.log(`Encontradas ${sqliteSkills.length} habilidades no SQLite.`);
  for (const s of sqliteSkills) {
    const exists = await pool.query('SELECT id FROM skills WHERE id = $1', [s.id]);
    if (exists.rows.length === 0) {
      await pool.query(
        `INSERT INTO skills (id, character_id, name, base_value, value, is_occupation, is_interest, occ_points, int_points, game_points)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [s.id, s.character_id, s.name, s.base_value || 0, s.value || 0, s.is_occupation || 0, s.is_interest || 0, s.occ_points || 0, s.int_points || 0, s.game_points || 0]
      );
    }
  }

  // 4. Migrate Weapons
  console.log('Migrando Armas de Personagem (Weapons)...');
  const sqliteWeapons = sqliteQuery('SELECT * FROM weapons');
  console.log(`Encontradas ${sqliteWeapons.length} armas de personagem no SQLite.`);
  for (const w of sqliteWeapons) {
    const exists = await pool.query('SELECT id FROM weapons WHERE id = $1', [w.id]);
    if (exists.rows.length === 0) {
      await pool.query(
        `INSERT INTO weapons (id, character_id, name, skill, damage, range, attacks_per_round, ammo, malfunction)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [w.id, w.character_id, w.name || '', w.skill || '', w.damage || '', w.range || '', w.attacks_per_round || '1', w.ammo || 0, w.malfunction || 100]
      );
    }
  }

  // 5. Migrate Possessions
  console.log('Migrando Posses de Personagem (Possessions)...');
  const sqlitePossessions = sqliteQuery('SELECT * FROM possessions');
  console.log(`Encontrados ${sqlitePossessions.length} itens de posse no SQLite.`);
  for (const p of sqlitePossessions) {
    const exists = await pool.query('SELECT id FROM possessions WHERE id = $1', [p.id]);
    if (exists.rows.length === 0) {
      await pool.query(
        'INSERT INTO possessions (id, character_id, item) VALUES ($1, $2, $3)',
        [p.id, p.character_id, p.item || '']
      );
    }
  }

  // 6. Migrate Config (Per-User Configs)
  console.log('Migrando Configurações do App...');
  const sqliteConfig = sqliteQuery('SELECT * FROM config');
  console.log(`Encontradas ${sqliteConfig.length} configurações no SQLite.`);
  for (const cfg of sqliteConfig) {
    const exists = await pool.query('SELECT key FROM config WHERE user_id = $1 AND key = $2', [samuelUserId, cfg.key]);
    if (exists.rows.length === 0) {
      await pool.query(
        'INSERT INTO config (user_id, key, value) VALUES ($1, $2, $3)',
        [samuelUserId, cfg.key, cfg.value]
      );
    }
  }

  // 7. Migrate NPCs
  console.log('Migrando NPCs...');
  const sqliteNpcs = sqliteQuery('SELECT * FROM npcs');
  console.log(`Encontrados ${sqliteNpcs.length} NPCs no SQLite.`);
  for (const npc of sqliteNpcs) {
    const exists = await pool.query('SELECT id FROM npcs WHERE id = $1', [npc.id]);
    if (exists.rows.length === 0) {
      await pool.query(
        `INSERT INTO npcs (
          id, user_id, name, type, description, str, dex, int_val, con, pow, siz,
          hp_current, hp_max, mp_current, mp_max, san_current, san_max,
          damage_bonus, build, armor, attacks, skills_text, special_abilities, notes, image, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)`,
        [
          npc.id, samuelUserId, npc.name, npc.type || 'npc', npc.description || '', npc.str || 50, npc.dex || 50,
          npc.int_val || 50, npc.con || 50, npc.pow || 50, npc.siz || 50, npc.hp_current || 10, npc.hp_max || 10,
          npc.mp_current || 10, npc.mp_max || 10, npc.san_current || 50, npc.san_max || 50, npc.damage_bonus || '',
          npc.build || '', npc.armor || 0, npc.attacks || '[]', npc.skills_text || '', npc.special_abilities || '',
          npc.notes || '', npc.image || '', npc.created_at || new Date(), npc.updated_at || new Date()
        ]
      );
    }
  }

  // 8. Migrate Weapon Catalog
  console.log('Migrando Catálogo de Armas (Weapon Catalog)...');
  const sqliteCatalog = sqliteQuery('SELECT * FROM weapon_catalog');
  console.log(`Encontradas ${sqliteCatalog.length} armas no catálogo do SQLite.`);
  for (const cat of sqliteCatalog) {
    const exists = await pool.query('SELECT id FROM weapon_catalog WHERE id = $1', [cat.id]);
    if (exists.rows.length === 0) {
      await pool.query(
        `INSERT INTO weapon_catalog (
          id, user_id, name, skill, damage, range, attacks_per_round, ammo, malfunction, category, notes, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          cat.id, samuelUserId, cat.name || '', cat.skill || '', cat.damage || '', cat.range || '',
          cat.attacks_per_round || '1', cat.ammo || 0, cat.malfunction || 100, cat.category || 'other', cat.notes || '', cat.created_at || new Date()
        ]
      );
    }
  }

  // 9. Migrate Sessions (Campanhas do Mestre)
  console.log('Migrando Sessões / Campanhas do Mestre...');
  const sqliteSessions = sqliteQuery('SELECT * FROM sessions');
  console.log(`Encontradas ${sqliteSessions.length} sessões no SQLite.`);
  for (const s of sqliteSessions) {
    const exists = await pool.query('SELECT id FROM sessions WHERE id = $1', [s.id]);
    
    // Generate a clean session join code (e.g., CUTH42) if none exists
    const code = s.code || `CUTH${s.id}${Math.floor(Math.random() * 90 + 10)}`;

    if (exists.rows.length === 0) {
      await pool.query(
        `INSERT INTO sessions (id, user_id, code, name, notes, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          s.id, samuelUserId, code, s.name || 'Nova Campanha', s.notes || '',
          s.is_active ? true : false, s.created_at || new Date(), s.updated_at || new Date()
        ]
      );

      // Link character if session has character_id in SQLite
      if (s.character_id) {
        await pool.query(
          'INSERT INTO session_characters (session_id, character_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [s.id, s.character_id]
        );
      }
      console.log(`Sessão '${s.name}' (ID SQLite: ${s.id}) importada com código de convite '${code}'.`);
    }
  }

  // 10. Migrate Session Log Entries
  console.log('Migrando Histórico de Mensagens de Sessões...');
  const sqliteLogs = sqliteQuery('SELECT * FROM session_log_entries');
  console.log(`Encontrados ${sqliteLogs.length} registros de log no SQLite.`);
  for (const l of sqliteLogs) {
    const exists = await pool.query('SELECT id FROM session_log_entries WHERE id = $1', [l.id]);
    if (exists.rows.length === 0) {
      await pool.query(
        'INSERT INTO session_log_entries (id, session_id, content, created_at) VALUES ($1, $2, $3, $4)',
        [l.id, l.session_id, l.content || '', l.created_at || new Date()]
      );
    }
  }

  // 11. Migrate PDF Annotations
  console.log('Migrando Anotações de PDF...');
  const sqliteAnnotations = sqliteQuery('SELECT * FROM pdf_annotations');
  console.log(`Encontradas ${sqliteAnnotations.length} anotações de PDF no SQLite.`);
  for (const ann of sqliteAnnotations) {
    const exists = await pool.query('SELECT id FROM pdf_annotations WHERE id = $1', [ann.id]);
    if (exists.rows.length === 0) {
      await pool.query(
        'INSERT INTO pdf_annotations (id, user_id, filename, page, note, color, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [ann.id, samuelUserId, ann.filename, ann.page || 1, ann.note || '', ann.color || 'yellow', ann.created_at || new Date()]
      );
    }
  }

  // 12. Migrate Dice History
  console.log('Migrando Histórico de Rolagem de Dados...');
  const sqliteDice = sqliteQuery('SELECT * FROM dice_history');
  console.log(`Encontradas ${sqliteDice.length} rolagens de dados no SQLite.`);
  for (const d of sqliteDice) {
    const exists = await pool.query('SELECT id FROM dice_history WHERE id = $1', [d.id]);
    if (exists.rows.length === 0) {
      await pool.query(
        'INSERT INTO dice_history (id, character_id, expression, result, details, rolled_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [d.id, d.character_id || null, d.expression, d.result, d.details || '', d.rolled_at || new Date()]
      );
    }
  }

  // 13. Migrate Evidence
  console.log('Migrando Evidências...');
  const sqliteEvidence = sqliteQuery('SELECT * FROM evidence');
  console.log(`Encontradas ${sqliteEvidence.length} evidências no SQLite.`);
  for (const ev of sqliteEvidence) {
    const exists = await pool.query('SELECT id FROM evidence WHERE id = $1', [ev.id]);
    if (exists.rows.length === 0) {
      await pool.query(
        'INSERT INTO evidence (id, user_id, title, description, session_tag, image, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [ev.id, samuelUserId, ev.title, ev.description || '', ev.session_tag || '', ev.image || '', ev.created_at || new Date()]
      );
    }
  }

  // 14. Adjust PostgreSQL Serial Sequence Indexes (CRITICAL: prevents collisions on future INSERT statements)
  console.log('Ajustando índices das sequências de autoincremento (SERIAL) no PostgreSQL...');
  const tablesWithSerial = [
    'users', 'characters', 'friends', 'sessions', 'session_characters', 'skills',
    'weapons', 'possessions', 'dice_history', 'evidence', 'npcs', 'weapon_catalog',
    'session_log_entries', 'pdf_annotations'
  ];

  for (const t of tablesWithSerial) {
    try {
      const res = await pool.query(`SELECT MAX(id) FROM ${t}`);
      const maxId = res.rows[0].max;
      if (maxId) {
        const nextId = maxId + 1;
        await pool.query(`SELECT setval('${t}_id_seq', $1, false)`, [nextId]);
        console.log(`Tabela '${t}': Próximo ID definido para ${nextId}.`);
      }
    } catch (e) {
      console.warn(`Aviso: não foi possível ajustar sequência para tabela '${t}':`, e.message);
    }
  }

  console.log('\n--- MIGRAÇÃO CONCLUÍDA COM SUCESSO ---');
  console.log('Todos os personagens, armas, habilidades, usuários e históricos foram migrados.');
  console.log(`Login do Investigador: Use 'samuel.arao@gmail.com' com as credenciais originais para acessar.`);
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Erro grave durante a migração:', err);
  process.exit(1);
});
