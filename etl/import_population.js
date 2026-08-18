const fs = require('fs');
const path = require('path');
const db = require('../src/database');

// Read the file as text
const filePath = path.join(__dirname, '..', 'data', 'population_districts.csv');
const content = fs.readFileSync(filePath, 'latin1');

// Split into lines, remove empty lines
const lines = content.split('\n').filter(line => line.trim() !== '');

// Prepared statements (reused for performance)
const updateState = db.prepare(`
    UPDATE regions SET population = ? WHERE ags = ? AND level = 'state'
`);

const insertDistrict = db.prepare(`
    INSERT INTO regions (ags, name, level, population)
    VALUES (?, ?, 'district', ?)
    ON CONFLICT(ags) DO UPDATE SET population = excluded.population, name = excluded.name
`);

let stateCount = 0, districtCount = 0, skipped = 0;

for (const line of lines) {
    // Split by SEMICOLON, trim whitespace (and \r) from each part
    const parts = line.split(';').map(p => p.trim());

    if (parts.length < 3) { skipped++; continue; }

    const [rawCode, rawName, rawValue] = parts;

    // Skip the "Deutschland" (whole country) row
    if (rawCode === 'DG') { skipped++; continue; }

    // Convert population string to a number (remove any non-digit chars)
    const population = parseInt(rawValue.replace(/\D/g, ''), 10);
    if (isNaN(population)) { skipped++; continue; }

    if (rawCode.length <= 2) {
        // STATE level (e.g. "1" -> "01")
        const ags = rawCode.padStart(2, '0');
        updateState.run(population, ags);
        stateCount++;
    } else {
        // DISTRICT level (e.g. "1001" -> "01001")
        const ags = rawCode.padStart(5, '0');
        insertDistrict.run(ags, rawName, population);
        districtCount++;
    }
}

console.log(`✅ Updated ${stateCount} states`);
console.log(`✅ Inserted/updated ${districtCount} districts`);
console.log(`⚠️ Skipped ${skipped} lines`);

// Log provenance (required by project!)
db.prepare(`
    INSERT INTO import_runs (source_name, source_url, imported_at, row_count)
    VALUES (?, ?, datetime('now'), ?)
`).run(
    'Regionalstatistik 12411-01-01-4 (Population, 31.12.2024)',
    'https://www.regionalstatistik.de/genesis/online?operation=table&code=12411-01-01-4',
    stateCount + districtCount
);

console.log('✅ Provenance logged in import_runs table');