const fs = require('fs');
const path = require('path');
const db = require('../src/database');

const filePath = path.join(__dirname, '..', 'data', 'kreise_area.csv');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n').filter(l => l.trim() !== '');

const updateArea = db.prepare(`
    UPDATE regions SET area_km2 = ? WHERE ags = ? AND level = 'district'
`);

let updated = 0, skipped = 0;

// Start at i=1 to skip the header row
for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';').map(p => p.trim());
    const ags = parts[0];

    // Only process district-level rows: exactly 5 digits
    if (!/^\d{5}$/.test(ags)) { skipped++; continue; }

    const rawArea = parts[4];
    if (!rawArea) { skipped++; continue; }

    // "1 428,17" -> remove ALL whitespace -> "1428,17" -> "1428.17"
    const area = parseFloat(rawArea.replace(/\s/g, '').replace(',', '.'));
    if (isNaN(area)) { skipped++; continue; }

    const result = updateArea.run(area, ags);
    if (result.changes > 0) updated++;
    else skipped++;
}

console.log(`✅ Updated area for ${updated} districts`);
console.log(`⚠️ Skipped ${skipped} lines (state rows, header, or no AGS match)`);

// Log provenance - Source #3!
db.prepare(`
    INSERT INTO import_runs (source_name, source_url, imported_at, row_count)
    VALUES (?, ?, datetime('now'), ?)
`).run(
    'GV-ISys Gemeindeverzeichnis - Kreise (Fläche km²)',
    'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/04-kreise.html',
    updated
);
console.log('✅ Provenance logged - Source #3 complete!');