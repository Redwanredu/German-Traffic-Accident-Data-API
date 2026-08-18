const fs = require('fs');
const path = require('path');
const db = require('../src/database');

// === Get YEAR and filename from command line ===
// Usage: node etl/import_accidents.js 2023 data/accidents_2023.csv
const YEAR = parseInt(process.argv[2]);
const fileName = process.argv[3];

if (!YEAR || !fileName) {
    console.error('Usage: node etl/import_accidents.js <year> <csv-file-path>');
    process.exit(1);
}

const filePath = path.join(__dirname, '..', fileName);

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n').filter(l => l.trim() !== '');

// Parse header to find column positions (robust against column order changes)
const header = lines[0].split(';').map(h => h.trim());
const idx = (name) => header.indexOf(name);

const iULAND      = idx('ULAND');
const iUREGBEZ    = idx('UREGBEZ');
const iUKREIS     = idx('UKREIS');
const iUJAHR      = idx('UJAHR');
const iUMONAT     = idx('UMONAT');
const iUSTUNDE    = idx('USTUNDE');
const iUWOCHENTAG = idx('UWOCHENTAG');
const iUKATEGORIE = idx('UKATEGORIE');
const iIstRad     = idx('IstRad');
const iIstFuss    = idx('IstFuss');
const iLon        = idx('XGCSWGS84');
const iLat        = idx('YGCSWGS84');

// Lookup region_id by district AGS code
const findRegion = db.prepare(`SELECT region_id FROM regions WHERE ags = ?`);
const regionCache = new Map();

function getRegionId(ags) {
    if (regionCache.has(ags)) return regionCache.get(ags);

    let row = findRegion.get(ags);

    // Fallback: try state-level AGS (first 2 digits)
    // Handles Berlin (11001-11012) and Hamburg (02xxx) boroughs,
    // which Unfallatlas reports at sub-district level but our
    // regions table only has at the city-state level.
    if (!row) {
        const stateAGS = ags.substring(0, 2);
        row = findRegion.get(stateAGS);
    }

    const id = row ? row.region_id : null;
    regionCache.set(ags, id);
    return id;
}

const insertAccident = db.prepare(`
    INSERT INTO accidents 
    (year, month, hour, weekday, category, is_pedestrian, is_bicycle, lon, lat, region_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let inserted = 0, notFound = 0;

// Wrap everything in ONE transaction (much faster for many rows)
const importAll = db.transaction(() => {
    // Clear previous import for this year to avoid duplicates when re-running
    db.prepare(`DELETE FROM accidents WHERE year = ?`).run(YEAR);

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';');
        if (cols.length < header.length) continue;

        const districtAGS = cols[iULAND].trim() + cols[iUREGBEZ].trim() + cols[iUKREIS].trim();
        const regionId = getRegionId(districtAGS);
        if (!regionId) notFound++;

        // Convert German decimal comma "10,148875" -> "10.148875"
        const lon = parseFloat(cols[iLon].replace(',', '.'));
        const lat = parseFloat(cols[iLat].replace(',', '.'));

        insertAccident.run(
            parseInt(cols[iUJAHR]),
            parseInt(cols[iUMONAT]),
            parseInt(cols[iUSTUNDE]),
            parseInt(cols[iUWOCHENTAG]),
            parseInt(cols[iUKATEGORIE]),
            parseInt(cols[iIstFuss]),
            parseInt(cols[iIstRad]),
            lon, lat,
            regionId
        );
        inserted++;
    }
});

importAll();

console.log(`✅ Inserted ${inserted} accidents for year ${YEAR}`);
console.log(`⚠️ ${notFound} rows had no matching region (even after fallback)`);

// Log provenance
db.prepare(`
    INSERT INTO import_runs (source_name, source_url, imported_at, row_count)
    VALUES (?, ?, datetime('now'), ?)
`).run(
    `Unfallatlas ${YEAR} (Punktdaten EPSG25832)`,
    'https://www.opengeodata.nrw.de/produkte/transport_verkehr/unfallatlas/',
    inserted
);
console.log('✅ Provenance logged');