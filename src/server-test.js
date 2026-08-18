const STATE_CODES = require('./stateCodes');
const db = require('./database');
const express = require('express');
const cors = require('cors');


const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
    res.json({ message: 'DBW Accident API is running 🚗' });
});

// GET /regions - list all regions, optionally filtered by level
// Example: /regions?level=state
app.get('/regions', (req, res) => {
    const { level } = req.query;

    let regions;
    if (level) {
        regions = db.prepare(`
            SELECT region_id, ags, name, level, population 
            FROM regions 
            WHERE level = ?
            ORDER BY ags
        `).all(level);
    } else {
        regions = db.prepare(`
            SELECT region_id, ags, name, level, population 
            FROM regions 
            ORDER BY ags
        `).all();
    }

    res.json({
        count: regions.length,
        data: regions
    });
});
// GET /accidents - filtered list of accidents
// Examples:
//   /accidents?state=SN&year=2023
//   /accidents?year=2023&category=1&pedestrian=true
//   /accidents?bicycle=true&year=2024&state=SN
app.get('/accidents', (req, res) => {
    const { state, year, month, weekday, hour, category, pedestrian, bicycle, limit, offset } = req.query;

    // Build WHERE clause dynamically
    let conditions = [];
    let params = [];

    // Join with regions if filtering by state
    let joinClause = '';
    if (state) {
        const ags = STATE_CODES[state.toUpperCase()];
        if (!ags) {
            return res.status(400).json({ error: `Unknown state code: ${state}. Use 2-letter codes like SN, BE, NW.` });
        }
        joinClause = 'JOIN regions r ON a.region_id = r.region_id';
        conditions.push('r.ags LIKE ?');
        params.push(ags + '%');
    }

    if (year) { conditions.push('a.year = ?'); params.push(parseInt(year)); }
    if (month) { conditions.push('a.month = ?'); params.push(parseInt(month)); }
    if (weekday) { conditions.push('a.weekday = ?'); params.push(parseInt(weekday)); }
    if (hour) { conditions.push('a.hour = ?'); params.push(parseInt(hour)); }
    if (category) { conditions.push('a.category = ?'); params.push(parseInt(category)); }
    if (pedestrian === 'true') { conditions.push('a.is_pedestrian = 1'); }
    if (bicycle === 'true') { conditions.push('a.is_bicycle = 1'); }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Pagination - default 100 results, max 1000
    const lim = Math.min(parseInt(limit) || 100, 1000);
    const off = parseInt(offset) || 0;

    const query = `
        SELECT a.accident_id, a.year, a.month, a.hour, a.weekday, a.category,
               a.is_pedestrian, a.is_bicycle, a.lon, a.lat, a.region_id
        FROM accidents a
        ${joinClause}
        ${whereClause}
        LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(query).all(...params, lim, off);

    // Also get total count (without limit) for pagination info
    const countQuery = `
        SELECT COUNT(*) as total
        FROM accidents a
        ${joinClause}
        ${whereClause}
    `;
    const { total } = db.prepare(countQuery).get(...params);

    res.json({
        total,
        limit: lim,
        offset: off,
        count: rows.length,
        data: rows
    });
});

// GET /aggregates/accidents - grouped accident counts
// Examples:
//   /aggregates/accidents?level=state&year=2023
//   /aggregates/accidents?level=district&year=2024&category=1
//   /aggregates/accidents?level=district&year=2023&state=SN
app.get('/aggregates/accidents', (req, res) => {
    const { level, year, category, state } = req.query;

    if (!level || (level !== 'state' && level !== 'district')) {
        return res.status(400).json({ 
            error: "Query parameter 'level' must be 'state' or 'district'" 
        });
    }

    let conditions = [];
    let params = [];

    if (year) { conditions.push('a.year = ?'); params.push(parseInt(year)); }
    if (category) { conditions.push('a.category = ?'); params.push(parseInt(category)); }

    let query;

    if (level === 'state') {
        if (state) {
            const ags = STATE_CODES[state.toUpperCase()];
            if (!ags) return res.status(400).json({ error: `Unknown state code: ${state}` });
            conditions.push('r2.ags = ?');
            params.push(ags);
        }
        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

        // r2 = the STATE region, found via the first 2 digits of the district's AGS
        query = `
            SELECT r2.ags, r2.name, COUNT(*) as accident_count
            FROM accidents a
            JOIN regions r ON a.region_id = r.region_id
            JOIN regions r2 ON r2.ags = substr(r.ags, 1, 2) AND r2.level = 'state'
            ${whereClause}
            GROUP BY r2.ags, r2.name
            ORDER BY r2.ags
        `;
    } else {
        conditions.push("r.level = 'district'");
        if (state) {
            const ags = STATE_CODES[state.toUpperCase()];
            if (!ags) return res.status(400).json({ error: `Unknown state code: ${state}` });
            conditions.push('r.ags LIKE ?');
            params.push(ags + '%');
        }
        const whereClause = 'WHERE ' + conditions.join(' AND ');

        query = `
            SELECT r.ags, r.name, COUNT(*) as accident_count
            FROM accidents a
            JOIN regions r ON a.region_id = r.region_id
            ${whereClause}
            GROUP BY r.ags, r.name
            ORDER BY accident_count DESC
        `;
    }

    const rows = db.prepare(query).all(...params);

    res.json({
        level,
        year: year ? parseInt(year) : null,
        category: category ? parseInt(category) : null,
        count: rows.length,
        data: rows
    });
});

// GET /aggregates/rates - accident rate per 100,000 inhabitants
// Combines Unfallatlas (accidents) + Regionalstatistik (population)
// Examples:
//   /aggregates/rates?level=state&year=2023
//   /aggregates/rates?level=district&year=2023&limit=5
//   /aggregates/rates?level=district&year=2023&limit=5&sort=asc
app.get('/aggregates/rates', (req, res) => {
    const { level, year, limit, sort } = req.query;

    if (!level || (level !== 'state' && level !== 'district')) {
        return res.status(400).json({ error: "Query parameter 'level' must be 'state' or 'district'" });
    }
    if (!year) {
        return res.status(400).json({ error: "Query parameter 'year' is required" });
    }

    // Only allow 'ASC' or 'DESC' - prevents SQL injection via sort param
    const sortOrder = sort === 'asc' ? 'ASC' : 'DESC';
    const lim = limit ? Math.min(parseInt(limit), 500) : null;

    let query;
    if (level === 'state') {
        query = `
            SELECT r2.ags, r2.name, r2.population, 
                   COUNT(a.accident_id) as accident_count,
                   ROUND(COUNT(a.accident_id) * 100000.0 / r2.population, 2) as rate_per_100k
            FROM accidents a
            JOIN regions r ON a.region_id = r.region_id
            JOIN regions r2 ON r2.ags = substr(r.ags, 1, 2) AND r2.level = 'state'
            WHERE a.year = ?
            GROUP BY r2.ags, r2.name, r2.population
            ORDER BY rate_per_100k ${sortOrder}
            ${lim ? 'LIMIT ' + lim : ''}
        `;
    } else {
        query = `
            SELECT r.ags, r.name, r.population,
                   COUNT(a.accident_id) as accident_count,
                   ROUND(COUNT(a.accident_id) * 100000.0 / r.population, 2) as rate_per_100k
            FROM accidents a
            JOIN regions r ON a.region_id = r.region_id
            WHERE r.level = 'district' AND a.year = ?
            GROUP BY r.ags, r.name, r.population
            ORDER BY rate_per_100k ${sortOrder}
            ${lim ? 'LIMIT ' + lim : ''}
        `;
    }

    const rows = db.prepare(query).all(parseInt(year));

    res.json({
        level,
        year: parseInt(year),
        note: 'rate_per_100k combines Unfallatlas (accidents) and Regionalstatistik (population) — cross-source aggregation',
        count: rows.length,
        data: rows
    });
});
// GET /metadata/sources - data provenance and licensing info
// Required by task description page 21: licenses must be transmitted to clients
app.get('/metadata/sources', (req, res) => {
    const runs = db.prepare(`
        SELECT import_id, source_name, source_url, imported_at, row_count 
        FROM import_runs 
        ORDER BY import_id
    `).all();

    const data = runs.map(run => ({
        ...run,
        license: 'Datenlizenz Deutschland – Namensnennung – Version 2.0',
        license_url: 'https://www.govdata.de/dl-de/by-2-0'
    }));

    res.json({
        count: data.length,
        data: data
    });
});

// 404 handler - catches requests to undefined routes
// Must be AFTER all other routes
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `The endpoint ${req.method} ${req.path} does not exist`,
        available_endpoints: [
            'GET /regions',
            'GET /accidents',
            'GET /aggregates/accidents',
            'GET /aggregates/rates',
            'GET /metadata/sources'
        ]
    });
});

// Global error handler - catches unexpected errors (e.g. DB errors)
// Must have 4 parameters (err, req, res, next) for Express to recognize it
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: 'Something went wrong while processing your request'
    });
});


app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});