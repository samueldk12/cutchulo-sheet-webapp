const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const SQLITE_DB_PATH = 'C:\\Users\\samue\\projects\\cutchulo-sheet\\data\\cthulhu.db';

async function dump() {
  if (!fs.existsSync(SQLITE_DB_PATH)) {
    console.error('No database file found at ' + SQLITE_DB_PATH);
    return;
  }
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(SQLITE_DB_PATH);
  const db = new SQL.Database(fileBuffer);

  function query(sql) {
    const stmt = db.prepare(sql);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  // Get table list
  const tables = query("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Tables:', tables.map(t => t.name));

  for (const t of tables) {
    const data = query(`SELECT * FROM ${t.name}`);
    console.log(`Table ${t.name}: ${data.length} rows`);
    fs.writeFileSync(`scratch/${t.name}.json`, JSON.stringify(data, null, 2));
  }
  console.log('Dumping finished!');
}

dump().catch(console.error);
