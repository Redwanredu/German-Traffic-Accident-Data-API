const db = require('../src/database');

// German federal states with their official AGS state codes (2-digit)
// and approximate population (2023 data, in number of people)
const states = [
    { ags: '01', name: 'Schleswig-Holstein',        population: 2953270 },
    { ags: '02', name: 'Hamburg',                   population: 1945532 },
    { ags: '03', name: 'Niedersachsen',             population: 8140242 },
    { ags: '04', name: 'Bremen',                    population: 684864  },
    { ags: '05', name: 'Nordrhein-Westfalen',       population: 18139116 },
    { ags: '06', name: 'Hessen',                    population: 6391360 },
    { ags: '07', name: 'Rheinland-Pfalz',           population: 4159150 },
    { ags: '08', name: 'Baden-Württemberg',         population: 11280257 },
    { ags: '09', name: 'Bayern',                    population: 13369393 },
    { ags: '10', name: 'Saarland',                  population: 984057  },
    { ags: '11', name: 'Berlin',                    population: 3677472 },
    { ags: '12', name: 'Brandenburg',               population: 2573135 },
    { ags: '13', name: 'Mecklenburg-Vorpommern',    population: 1628378 },
    { ags: '14', name: 'Sachsen',                   population: 4086385 },
    { ags: '15', name: 'Sachsen-Anhalt',            population: 2186643 },
    { ags: '16', name: 'Thüringen',                 population: 2095724 },
];

// Prepare an INSERT statement (prevents SQL injection, faster too)
const insert = db.prepare(`
    INSERT OR IGNORE INTO regions (ags, name, level, population)
    VALUES (?, ?, 'state', ?)
`);

// Loop through each state and insert it
for (const state of states) {
    insert.run(state.ags, state.name, state.population);
    console.log(`Inserted: ${state.name}`);
}

console.log('✅ Done seeding states!');