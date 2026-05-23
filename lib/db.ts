import { Pool } from 'pg';

let pool: Pool;

function getPoolConfig() {
  const connectionString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  
  if (connectionString) {
    return {
      connectionString,
      ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon') || process.env.PGHOST?.includes('neon')
        ? { rejectUnauthorized: false }
        : undefined,
    };
  }
  
  // Support individual environment variables
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

if (process.env.NODE_ENV === 'production') {
  pool = new Pool(poolConfig);
} else {
  if (!(global as any).pgPool) {
    (global as any).pgPool = new Pool(poolConfig);
  }
  pool = (global as any).pgPool;
}

export { pool };

// --- DB Schema & Initialization ---
let isDbInitialized = false;
let dbInitPromise: Promise<void> | null = null;

const DEFAULT_CONFIG = {
  formula_hp: 'Math.floor((CON + SIZ) / 10)',
  formula_mp: 'Math.floor(POW / 5)',
  formula_san: 'POW * 5',
  formula_dodge: 'Math.floor(DEX / 2)',
  formula_lang_own: 'EDU',
  formula_mov: '((STR > SIZ && DEX > SIZ) ? 9 : ((STR < SIZ && DEX < SIZ) ? 7 : 8)) - (AGE >= 80 ? 5 : AGE >= 70 ? 4 : AGE >= 60 ? 3 : AGE >= 50 ? 2 : AGE >= 40 ? 1 : 0)',
  formula_occ_points: 'EDU * 4',
  formula_int_points: 'INT * 2',
  formula_brawl: '25',
  auto_calc: 'true',
};

export const DEFAULT_SKILLS = [
  { name: 'Accounting (Contabilidade)', base: 5 },
  { name: 'Anthropology (Antropologia)', base: 1 },
  { name: 'Appraise (Avaliar)', base: 5 },
  { name: 'Archaeology (Arqueologia)', base: 1 },
  { name: 'Art/Craft (Arte/Artesanato)', base: 5 },
  { name: 'Charm (Charme)', base: 15 },
  { name: 'Climb (Escalar)', base: 20 },
  { name: 'Computer Use (Computador)', base: 5 },
  { name: 'Credit Rating (Crédito)', base: 0 },
  { name: 'Cthulhu Mythos (Mitos de Cthulhu)', base: 0 },
  { name: 'Demolitions (Demolições)', base: 1 },
  { name: 'Disguise (Disfarce)', base: 5 },
  { name: 'Diving (Mergulho)', base: 1 },
  { name: 'Dodge (Esquivar)', base: 0 },
  { name: 'Drive Auto (Dirigir)', base: 20 },
  { name: 'Elec. Repair (Rep. Elétrica)', base: 10 },
  { name: 'Electronics (Eletrônica)', base: 1 },
  { name: 'Fast Talk (Conversa Fiada)', base: 5 },
  { name: 'Fighting (Brawl) (Luta)', base: 25 },
  { name: 'Firearms (Handgun) (Pistola)', base: 20 },
  { name: 'Firearms (Rifle/Shotgun) (Rifle)', base: 25 },
  { name: 'Firearms (Submachine Gun) (Submetralhadora)', base: 15 },
  { name: 'First Aid (Primeiros Socorros)', base: 30 },
  { name: 'History (História)', base: 5 },
  { name: 'Intimidate (Intimidar)', base: 15 },
  { name: 'Jump (Saltar)', base: 20 },
  { name: 'Language (Other) (Idioma - Outro)', base: 1 },
  { name: 'Language (Own) (Idioma - Próprio)', base: 0 },
  { name: 'Law (Direito)', base: 5 },
  { name: 'Library Use (Pesquisa em Biblioteca)', base: 20 },
  { name: 'Listen (Ouvir)', base: 20 },
  { name: 'Locksmith (Ladrão de Cofres)', base: 1 },
  { name: 'Mech. Repair (Rep. Mecânica)', base: 10 },
  { name: 'Medicine (Medicina)', base: 1 },
  { name: 'Natural World (Mundo Natural)', base: 10 },
  { name: 'Navigate (Navegação)', base: 10 },
  { name: 'Occult (Ocultismo)', base: 5 },
  { name: 'Op. Heavy Machinery (Op. Máq. Pesada)', base: 1 },
  { name: 'Persuade (Persuadir)', base: 10 },
  { name: 'Photography (Fotografia)', base: 1 },
  { name: 'Pilot (Pilotagem)', base: 1 },
  { name: 'Psychology (Psicologia)', base: 10 },
  { name: 'Psychoanalysis (Psicanálise)', base: 1 },
  { name: 'Read Lips (Leitura Labial)', base: 1 },
  { name: 'Ride (Equitação)', base: 5 },
  { name: 'Science (Biology) (Biologia)', base: 1 },
  { name: 'Science (Botany) (Botânica)', base: 1 },
  { name: 'Science (Chemistry) (Química)', base: 1 },
  { name: 'Science (Cryptography) (Criptografia)', base: 1 },
  { name: 'Science (Engineering) (Engenharia)', base: 1 },
  { name: 'Science (Forensics) (Forense)', base: 1 },
  { name: 'Science (Geology) (Geologia)', base: 1 },
  { name: 'Science (Mathematics) (Matemática)', base: 1 },
  { name: 'Science (Meteorology) (Meteorologia)', base: 1 },
  { name: 'Science (Pharmacy) (Farmácia)', base: 1 },
  { name: 'Science (Physics) (Física)', base: 1 },
  { name: 'Science (Zoology) (Zoologia)', base: 1 },
  { name: 'Sleight of Hand (Prestidigitação)', base: 10 },
  { name: 'Spot Hidden (Detectar)', base: 25 },
  { name: 'Stealth (Furtividade)', base: 20 },
  { name: 'Survival (Sobrevivência)', base: 10 },
  { name: 'Swim (Nadar)', base: 20 },
  { name: 'Throw (Arremesso)', base: 20 },
  { name: 'Track (Rastrear)', base: 10 },
];

export async function initDb() {
  if (isDbInitialized) return;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    console.log('Initializing PostgreSQL database schemas...');
    
    // 1. Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Characters Table
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

    // 3. Friends Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS friends (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, character_id)
      );
    `);

    // 4. Sessions Table (GM Campaigns)
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

    // 5. Session Characters Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS session_characters (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
        character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
        UNIQUE(session_id, character_id)
      );
    `);

    // 6. Skills Table
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

    // 7. Weapons Table
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

    // 8. Possessions Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS possessions (
        id SERIAL PRIMARY KEY,
        character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
        item TEXT DEFAULT ''
      );
    `);

    // 8.5. Spells Table (Grimório)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS spells (
        id SERIAL PRIMARY KEY,
        character_id INTEGER REFERENCES characters(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL DEFAULT '',
        cost VARCHAR(255) DEFAULT '',
        casting_time VARCHAR(255) DEFAULT '',
        range VARCHAR(255) DEFAULT '',
        duration VARCHAR(255) DEFAULT '',
        description TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 9. Dice History Table
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

    // 10. Config Table (Per User Settings)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS config (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        key VARCHAR(255) NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (user_id, key)
      );
    `);

    // 11. Evidence Table
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

    // 12. NPCs Table
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

    // 13. Weapon Catalog Table
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

    // 14. Session Log Entries Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS session_log_entries (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
        content TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 15. PDF Annotations Table
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

    // 16. Session Messages Table (Live chat, rolls, whispers)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS session_messages (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        message_type VARCHAR(50) DEFAULT 'chat',
        content TEXT DEFAULT '',
        roll_details JSONB DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure sessions has roll20_url column
    await pool.query(`
      ALTER TABLE sessions ADD COLUMN IF NOT EXISTS roll20_url VARCHAR(500) DEFAULT '';
    `);

    isDbInitialized = true;
    console.log('PostgreSQL database schema initialized successfully.');
  })();

  return dbInitPromise;
}

export async function query(text: string, params?: any[]) {
  await initDb();
  return pool.query(text, params);
}

export async function queryOne(text: string, params?: any[]) {
  await initDb();
  const { rows } = await pool.query(text, params);
  return rows[0] || null;
}

export async function createDefaultSkills(characterId: number, dex: number, edu: number) {
  await initDb();
  for (const skill of DEFAULT_SKILLS) {
    let base = skill.base;
    if (skill.name.includes('Dodge')) base = Math.floor(dex / 2);
    if (skill.name.includes('Language (Own)')) base = edu;
    
    // Credit Rating starts as occupation skill in CoC 7e
    const isOcc = skill.name.includes('Credit Rating') ? 1 : 0;
    
    await pool.query(
      'INSERT INTO skills (character_id, name, base_value, value, is_occupation) VALUES ($1, $2, $3, $4, $5)',
      [characterId, skill.name, base, base, isOcc]
    );
  }
}
