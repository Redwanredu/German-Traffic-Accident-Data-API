const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Creates (or opens) a file called accidents.db
const db = new Database(path.join(__dirname, '..', 'data', 'accidents.db'));

// Read the init.sql file as text
const initSql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');

// Run all the CREATE TABLE statements
db.exec(initSql);

console.log('Database initialized ✅');

module.exports = db;