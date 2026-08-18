const db = require('../src/database');

console.log('========================================');
console.log('1. Accident counts per year');
console.log('========================================');
const yearCounts = db.prepare(`
    SELECT year, COUNT(*) as count FROM accidents GROUP BY year ORDER BY year
`).all();
console.log(yearCounts);

console.log('\n========================================');
console.log('2. Earliest accident year overall');
console.log('========================================');
const earliest = db.prepare(`SELECT MIN(year) as earliest_year FROM accidents`).get();
console.log(earliest);

console.log('\n========================================');
console.log('3. Saxony (Sachsen) accidents in 2023');
console.log('   (matches mandatory question #2)');
console.log('========================================');
const sachsen2023 = db.prepare(`
    SELECT COUNT(*) as count 
    FROM accidents a 
    JOIN regions r ON a.region_id = r.region_id 
    WHERE r.ags LIKE '14%' AND a.year = 2023
`).get();
console.log(sachsen2023);

console.log('\n========================================');
console.log('4. Berlin pedestrian accidents in 2023');
console.log('   (matches mandatory question #5)');
console.log('========================================');
const berlinPed2023 = db.prepare(`
    SELECT COUNT(*) as count 
    FROM accidents a 
    JOIN regions r ON a.region_id = r.region_id 
    WHERE r.ags LIKE '11%' AND a.year = 2023 AND a.is_pedestrian = 1
`).get();
console.log(berlinPed2023);

console.log('\n========================================');
console.log('5. Earliest year for NRW (ags=05)');
console.log('   (matches mandatory question #3)');
console.log('========================================');
const nrwEarliest = db.prepare(`
    SELECT MIN(a.year) as earliest_year 
    FROM accidents a 
    JOIN regions r ON a.region_id = r.region_id 
    WHERE r.ags LIKE '05%'
`).get();
console.log(nrwEarliest);

console.log('\n========================================');
console.log('6. Earliest year for Mecklenburg-Vorpommern (ags=13)');
console.log('   (matches mandatory question #4)');
console.log('========================================');
const mvEarliest = db.prepare(`
    SELECT MIN(a.year) as earliest_year 
    FROM accidents a 
    JOIN regions r ON a.region_id = r.region_id 
    WHERE r.ags LIKE '13%'
`).get();
console.log(mvEarliest);

console.log('\n========================================');
console.log('7. Category distribution (1=fatal, 2=serious, 3=light)');
console.log('========================================');
const categories = db.prepare(`
    SELECT category, COUNT(*) as count FROM accidents GROUP BY category ORDER BY category
`).all();
console.log(categories);

console.log('\n========================================');
console.log('8. Population sanity check (top 3 states)');
console.log('========================================');
const topPop = db.prepare(`
    SELECT name, population FROM regions WHERE level='state' ORDER BY population DESC LIMIT 3
`).all();
console.log(topPop);

console.log('\n========================================');
console.log('9. Import runs (provenance log)');
console.log('========================================');
const imports = db.prepare(`SELECT * FROM import_runs`).all();
console.log(imports);