const db = require('../src/database');

// Remove failed/empty import attempts (row_count = 0)
const result = db.prepare(`DELETE FROM import_runs WHERE row_count = 0`).run();
console.log(`Removed ${result.changes} empty import_run entries`);