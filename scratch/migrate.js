const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const initSqlJs = require('sql.js');

// 1. Read environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
let databaseUrl = 'postgresql://postgres:postgres@localhost:5432/cutchulo?sslmode=disable';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^DATABASE_URL=(.+)$/m);
  if (match) {
    databaseUrl = match[1].trim();
  }
}

console.log('Database URL to connect:', databaseUrl);

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('sslmode=require') || databaseUrl.includes('neon')
    ? { rejectUnauthorized: false }
    : undefined,
});

const SQLITE_DB_PATH = 'C:\\Users\\samue\\projects\\cutchulo-sheet\\data\\cthulhu.db';

async function runMigration() {
  console.log('Iniciando migração de SQLite para PostgreSQL...');
  
  if (!fs.existsSync(SQLITE_DB_PATH)) {
    console.error(`Database SQLite não encontrado em ${SQLITE_DB_PATH}`);
    process.exit(1);
  }

  // Initialize SQLite Parser
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(SQLITE_DB_PATH);
  const db = new SQL.Database(fileBuffer);

  // Helper to query SQLite
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

  // Create default user if not exists
  const username = 'samuel';
  const defaultPassword = '123';
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(defaultPassword, salt);

  // Verify / Create User
  let userId;
  const userCheck = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  if (userCheck.rows.length > 0) {
    userId = userCheck.rows[0].id;
    console.log(`Usuário '${username}' já existe com ID ${userId}`);
  } else {
    const userInsert = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
      [username, passwordHash]
    );
    userId = userInsert.rows[0].id;
    console.log(`Usuário padrão '${username}' criado com ID ${userId}`);
  }

  // 1. Migrate Weapon Catalog
  console.log('Migrando Weapon Catalog...');
  const sqliteWeaponsCatalog = sqliteQuery('SELECT * FROM weapon_catalog');
  console.log(`Encontrados ${sqliteWeaponsCatalog.length} itens no catálogo de armas.`);
  
  for (const w of sqliteWeaponsCatalog) {
    // Check if weapon already exists in catalog
    const exists = await pool.query('SELECT id FROM weapon_catalog WHERE name = $1 AND user_id = $2', [w.name, userId]);
    if (exists.rows.length === 0) {
      await pool.query(
        `INSERT INTO weapon_catalog 
          (user_id, name, skill, damage, range, attacks_per_round, ammo, malfunction, category, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [userId, w.name || '', w.skill || '', w.damage || '', w.range || '', w.attacks_per_round || '1', w.ammo || 0, w.malfunction || 100, w.category || 'other', w.notes || '']
      );
    }
  }

  // 2. Migrate Evidence
  console.log('Migrando Evidências...');
  const sqliteEvidence = sqliteQuery('SELECT * FROM evidence');
  for (const ev of sqliteEvidence) {
    await pool.query(
      'INSERT INTO evidence (user_id, title, description, session_tag, image) VALUES ($1, $2, $3, $4, $5)',
      [userId, ev.title || 'Nova Evidência', ev.description || '', ev.session_tag || '', ev.image || '']
    );
  }

  // 3. Migrate NPCs
  console.log('Migrando NPCs...');
  const sqliteNpcs = sqliteQuery('SELECT * FROM npcs');
  for (const npc of sqliteNpcs) {
    await pool.query(
      `INSERT INTO npcs 
        (user_id, name, type, description, str, dex, int_val, con, pow, siz,
         hp_current, hp_max, mp_current, mp_max, san_current, san_max,
         damage_bonus, build, armor, attacks, skills_text, special_abilities, notes, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)`,
      [
        userId, npc.name, npc.type || 'npc', npc.description || '',
        npc.str || 50, npc.dex || 50, npc.int_val || 50, npc.con || 50, npc.pow || 50, npc.siz || 50,
        npc.hp_current || 10, npc.hp_max || 10, npc.mp_current || 10, npc.mp_max || 10, npc.san_current || 50, npc.san_max || 50,
        npc.damage_bonus || '', npc.build || '', npc.armor || 0, npc.attacks || '[]', npc.skills_text || '', npc.special_abilities || '', npc.notes || '', npc.image || ''
      ]
    );
  }

  // 4. Migrate Characters
  console.log('Migrando Fichas de Investigadores...');
  const sqliteCharacters = sqliteQuery('SELECT * FROM characters');
  console.log(`Encontrados ${sqliteCharacters.length} investigadores.`);
  
  const charIdMap = new Map(); // Maps SQLite Character ID to PostgreSQL Character ID

  for (const c of sqliteCharacters) {
    // Generate UUID if empty
    const uuid = c.uuid || require('crypto').randomUUID();

    const insertCharRes = await pool.query(
      `INSERT INTO characters
        (user_id, uuid, name, player, occupation, age, gender, residence, birthplace,
         str, dex, int_val, con, app, pow, siz, edu, luck,
         hp_current, hp_max, mp_current, mp_max, san_current, san_max,
         temporary_insanity, indefinite_insanity, cash, assets, spending_level,
         appearance_desc, ideology, significant_people, meaningful_locations,
         treasured_possessions, traits, injuries_scars, phobias_manias, arcane_tomes,
         backstory, notes, image, is_friend, shared)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43)
       RETURNING id`,
      [
        userId, uuid, c.name, c.player || '', c.occupation || '', c.age || 25, c.gender || '', c.residence || '', c.birthplace || '',
        c.str || 50, c.dex || 50, c.int_val || 50, c.con || 50, c.app || 50, c.pow || 50, c.siz || 50, c.edu || 50, c.luck || 50,
        c.hp_current || 10, c.hp_max || 10, c.mp_current || 10, c.mp_max || 10, c.san_current || 50, c.san_max || 50,
        c.temporary_insanity || 0, c.indefinite_insanity || 0, c.cash || '', c.assets || '', c.spending_level || '',
        c.appearance_desc || '', c.ideology || '', c.significant_people || '', c.meaningful_locations || '',
        c.treasured_possessions || '', c.traits || '', c.injuries_scars || '', c.phobias_manias || '', c.arcane_tomes || '',
        c.backstory || '', c.notes || '', c.image || '', c.is_friend || 0, c.shared ? true : false
      ]
    );

    const newCharId = insertCharRes.rows[0].id;
    charIdMap.set(c.id, newCharId);
    console.log(`Migrado Investigador: ${c.name} (ID SQLite: ${c.id} -> ID Postgres: ${newCharId})`);

    // 4.1 Migrate Skills for this character
    const sqliteSkills = sqliteQuery('SELECT * FROM skills WHERE character_id = ?', [c.id]);
    for (const s of sqliteSkills) {
      await pool.query(
        `INSERT INTO skills 
          (character_id, name, base_value, value, is_occupation, is_interest, occ_points, int_points, game_points)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [newCharId, s.name, s.base_value || 0, s.value || 0, s.is_occupation || 0, s.is_interest || 0, s.occ_points || 0, s.int_points || 0, s.game_points || 0]
      );
    }

    // 4.2 Migrate Weapons for this character
    const sqliteWeapons = sqliteQuery('SELECT * FROM weapons WHERE character_id = ?', [c.id]);
    for (const w of sqliteWeapons) {
      await pool.query(
        `INSERT INTO weapons 
          (character_id, name, skill, damage, range, attacks_per_round, ammo, malfunction)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [newCharId, w.name || '', w.skill || '', w.damage || '', w.range || '', w.attacks_per_round || '1', w.ammo || 0, w.malfunction || 100]
      );
    }

    // 4.3 Migrate Possessions for this character
    const sqlitePossessions = sqliteQuery('SELECT * FROM possessions WHERE character_id = ?', [c.id]);
    for (const p of sqlitePossessions) {
      await pool.query(
        'INSERT INTO possessions (character_id, item) VALUES ($1, $2)',
        [newCharId, p.item || '']
      );
    }
  }

  // 5. Migrate PDF Annotations
  console.log('Migrando Anotações de PDF...');
  const sqliteAnnotations = sqliteQuery('SELECT * FROM pdf_annotations');
  for (const ann of sqliteAnnotations) {
    await pool.query(
      'INSERT INTO pdf_annotations (user_id, filename, page, note, color) VALUES ($1, $2, $3, $4, $5)',
      [userId, ann.filename, ann.page || 1, ann.note || '', ann.color || 'yellow']
    );
  }

  // 6. Migrate Dice History
  console.log('Migrando Histórico de Dados...');
  const sqliteDice = sqliteQuery('SELECT * FROM dice_history');
  for (const d of sqliteDice) {
    const pgCharId = d.character_id ? charIdMap.get(d.character_id) : null;
    await pool.query(
      'INSERT INTO dice_history (character_id, expression, result, details) VALUES ($1, $2, $3, $4)',
      [pgCharId || null, d.expression, d.result, d.details || '']
    );
  }

  console.log('--- MIGRAÇÃO CONCLUÍDA COM SUCESSO ---');
  console.log(`Use o usuário '${username}' com a senha '${defaultPassword}' para fazer login.`);
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
