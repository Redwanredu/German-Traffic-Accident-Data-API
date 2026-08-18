const db = require('../src/database');

// Check all 16 states and their population
const states = db.prepare(`
    SELECT ags, name, population FROM regions 
    WHERE level = 'state' 
    ORDER BY ags
`).all();
console.log('--- States ---');
console.log(states);

// Check district count
const districtCount = db.prepare(`
    SELECT COUNT(*) as count FROM regions WHERE level = 'district'
`).get();
console.log('--- District count ---');
console.log(districtCount);

// Check Sachsen specifically (AGS = 14)
const sachsen = db.prepare(`
    SELECT * FROM regions WHERE ags = '14'
`).get();
console.log('--- Sachsen ---');
console.log(sachsen);