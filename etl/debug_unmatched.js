const fs = require('fs');
const path = require('path');
const db = require('../src/database');

const filePath = path.join(__dirname, '..', 'data', 'accidents_2023.csv');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n').filter(l => l.trim() !== '');

const header = lines[0].split(';').map(h => h.trim());
const idx = (name) => header.indexOf(name);
const iULAND = idx('ULAND');
const iUREGBEZ = idx('UREGBEZ');
const iUKREIS = idx('UKREIS');

const findRegion = db.prepare(`SELECT region_id FROM regions WHERE ags = ?`);

// Count unmatched AGS codes
const unmatched = new Map();

for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    if (cols.length < header.length) continue;

    const ags = cols[iULAND].trim() + cols[iUREGBEZ].trim() + cols[iUKREIS].trim();
    const row = findRegion.get(ags);
    if (!row) {
        unmatched.set(ags, (unmatched.get(ags) || 0) + 1);
    }
}

// Sort by count, descending
const sorted = [...unmatched.entries()].sort((a, b) => b[1] - a[1]);
console.log(`Unique unmatched AGS codes: ${sorted.length}`);
console.log('Top unmatched codes:');
console.log(sorted.slice(0, 20));