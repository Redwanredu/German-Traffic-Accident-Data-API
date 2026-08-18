const db = require('../src/database');

try {
    db.exec(`ALTER TABLE regions ADD COLUMN area_km2 REAL`);
    console.log('✅ Added area_km2 column to regions table');
} catch (e) {
    if (e.message.includes('duplicate column')) {
        console.log('ℹ️ area_km2 column already exists, skipping');
    } else {
        throw e;
    }
}