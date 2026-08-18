const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'data', 'population_districts.csv');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n').filter(line => line.trim() !== '');

console.log(`Total lines: ${lines.length}`);
console.log('--- First 3 lines (raw) ---');
for (let i = 0; i < 3; i++) {
    console.log(JSON.stringify(lines[i]));  // shows hidden characters like \t
}

console.log('--- Split by TAB ---');
const partsTab = lines[1].split('\t');
console.log(`Parts (tab): ${partsTab.length}`, partsTab);

console.log('--- Split by multiple spaces ---');
const partsSpace = lines[1].split(/\s{2,}/);
console.log(`Parts (2+ spaces): ${partsSpace.length}`, partsSpace);