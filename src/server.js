const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const db = require('./database');
const STATE_CODES = require('./stateCodes');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Swagger / OpenAPI docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// ============================================
// ROUTES
// ============================================

/**
 * @openapi
 * /:
 *   get:
 *     summary: API health check
 *     responses:
 *       200:
 *         description: API is running
 */
app.get('/', (req, res) => {
    res.json({ message: 'DBW Accident API is running 🚗', docs: '/api-docs' });
});

/**
 * @openapi
 * /regions:
 *   get:
 *     summary: List regions (states or districts)
 *     description: Returns all regions, optionally filtered by administrative level. Source - Regionalstatistik 12411-01-01-4.
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [state, district]
 *         description: Filter by administrative level
 *     responses:
 *       200:
 *         description: List of regions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count: { type: integer }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Region' }
 */
app.get('/regions', (req, res) => {
    const { level } = req.query;

    let regions;
    if (level) {
        regions = db.prepare(`
            SELECT region_id, ags, name, level, population 
            FROM regions WHERE level = ? ORDER BY ags
        `).all(level);
    } else {
        regions = db.prepare(`
            SELECT region_id, ags, name, level, population 
            FROM regions ORDER BY ags
        `).all();
    }

    res.json({ count: regions.length, data: regions });
});

/**
 * @openapi
 * /accidents:
 *   get:
 *     summary: List accidents with filters
 *     description: Returns individual accident records. Source - Unfallatlas (opengeodata.nrw.de), years 2016-2024.
 *     parameters:
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *         description: "2-letter state code, e.g. SN (Sachsen), BE (Berlin), NW (NRW)"
 *       - in: query
 *         name: region
 *         schema: { type: string }
 *         description: "AGS region code (2-digit state or 5-digit district), e.g. 14612 for Dresden"
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         schema: { type: integer, minimum: 1, maximum: 12 }
 *       - in: query
 *         name: weekday
 *         schema: { type: integer, minimum: 1, maximum: 7 }
 *       - in: query
 *         name: hour
 *         schema: { type: integer, minimum: 0, maximum: 23 }
 *       - in: query
 *         name: category
 *         schema: { type: integer, enum: [1, 2, 3] }
 *         description: "1=fatal, 2=serious injury, 3=light injury"
 *       - in: query
 *         name: pedestrian
 *         schema: { type: boolean }
 *       - in: query
 *         name: bicycle
 *         schema: { type: boolean }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 100, maximum: 1000 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: Filtered accident list with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total: { type: integer }
 *                 limit: { type: integer }
 *                 offset: { type: integer }
 *                 count: { type: integer }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Accident' }
 *       400:
 *         description: Unknown state code
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
app.get('/accidents', (req, res) => {
    const { state, region, year, month, weekday, hour, category, pedestrian, bicycle, limit, offset } = req.query;

    let conditions = [];
    let params = [];
    let joinClause = '';

    if (state) {
        const ags = STATE_CODES[state.toUpperCase()];
        if (!ags) {
            return res.status(400).json({ error: 'Bad Request', message: `Unknown state code: ${state}. Use 2-letter codes like SN, BE, NW.` });
        }
        joinClause = 'JOIN regions r ON a.region_id = r.region_id';
        conditions.push('r.ags LIKE ?');
        params.push(ags + '%');
    }

    if (region) {
        joinClause = 'JOIN regions r ON a.region_id = r.region_id';
        conditions.push('r.ags LIKE ?');
        params.push(region + '%');
    }

    if (year) { conditions.push('a.year = ?'); params.push(parseInt(year)); }
    if (month) { conditions.push('a.month = ?'); params.push(parseInt(month)); }
    if (weekday) { conditions.push('a.weekday = ?'); params.push(parseInt(weekday)); }
    if (hour) { conditions.push('a.hour = ?'); params.push(parseInt(hour)); }
    if (category) { conditions.push('a.category = ?'); params.push(parseInt(category)); }
    if (pedestrian === 'true') { conditions.push('a.is_pedestrian = 1'); }
    if (bicycle === 'true') { conditions.push('a.is_bicycle = 1'); }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
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

    const countQuery = `SELECT COUNT(*) as total FROM accidents a ${joinClause} ${whereClause}`;
    const { total } = db.prepare(countQuery).get(...params);

    res.json({ total, limit: lim, offset: off, count: rows.length, data: rows });
});

/**
 * @openapi
 * /aggregates/accidents:
 *   get:
 *     summary: Aggregated accident counts by region
 *     description: Groups accident counts by state or district. Combines accident region keys with the regions table.
 *     parameters:
 *       - in: query
 *         name: level
 *         required: true
 *         schema: { type: string, enum: [state, district] }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: category
 *         schema: { type: integer, enum: [1, 2, 3] }
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *         description: "Filter districts to one state, e.g. SN"
 *     responses:
 *       200:
 *         description: Aggregated counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 level: { type: string }
 *                 year: { type: integer, nullable: true }
 *                 category: { type: integer, nullable: true }
 *                 count: { type: integer }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/AggregateRow' }
 *       400:
 *         description: Invalid level or state code
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
app.get('/aggregates/accidents', (req, res) => {
    const { level, year, category, state } = req.query;

    if (!level || (level !== 'state' && level !== 'district')) {
        return res.status(400).json({ error: 'Bad Request', message: "Query parameter 'level' must be 'state' or 'district'" });
    }

    let conditions = [];
    let params = [];

    if (year) { conditions.push('a.year = ?'); params.push(parseInt(year)); }
    if (category) { conditions.push('a.category = ?'); params.push(parseInt(category)); }

    let query;
    if (level === 'state') {
        if (state) {
            const ags = STATE_CODES[state.toUpperCase()];
            if (!ags) return res.status(400).json({ error: 'Bad Request', message: `Unknown state code: ${state}` });
            conditions.push('r2.ags = ?');
            params.push(ags);
        }
        const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
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
            if (!ags) return res.status(400).json({ error: 'Bad Request', message: `Unknown state code: ${state}` });
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
    res.json({ level, year: year ? parseInt(year) : null, category: category ? parseInt(category) : null, count: rows.length, data: rows });
});

/**
 * @openapi
 * /aggregates/rates:
 *   get:
 *     summary: Accident rate per 100,000 inhabitants (cross-source)
 *     description: Combines Unfallatlas accident counts with Regionalstatistik population figures to compute a normalised rate. Neither source alone can answer this.
 *     parameters:
 *       - in: query
 *         name: level
 *         required: true
 *         schema: { type: string, enum: [state, district] }
 *       - in: query
 *         name: year
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, maximum: 500 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Rate per 100,000 inhabitants per region
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 level: { type: string }
 *                 year: { type: integer }
 *                 note: { type: string }
 *                 count: { type: integer }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/RateRow' }
 *       400:
 *         description: Missing or invalid parameters
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
app.get('/aggregates/rates', (req, res) => {
    const { level, year, limit, sort } = req.query;

    if (!level || (level !== 'state' && level !== 'district')) {
        return res.status(400).json({ error: 'Bad Request', message: "Query parameter 'level' must be 'state' or 'district'" });
    }
    if (!year) {
        return res.status(400).json({ error: 'Bad Request', message: "Query parameter 'year' is required" });
    }

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
        note: 'rate_per_100k combines Unfallatlas (accidents) and Regionalstatistik (population) - cross-source aggregation',
        count: rows.length,
        data: rows
    });
});

/**
 * @openapi
 * /metadata/sources:
 *   get:
 *     summary: Data provenance and licensing information
 *     description: Lists every import run (source, retrieval time, row count) together with the applicable data license.
 *     responses:
 *       200:
 *         description: Provenance log
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count: { type: integer }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ImportRun' }
 */
app.get('/metadata/sources', (req, res) => {
    const runs = db.prepare(`
        SELECT import_id, source_name, source_url, imported_at, row_count 
        FROM import_runs ORDER BY import_id
    `).all();

    const data = runs.map(run => ({
        ...run,
        license: 'Datenlizenz Deutschland – Namensnennung – Version 2.0',
        license_url: 'https://www.govdata.de/dl-de/by-2-0'
    }));

    res.json({ count: data.length, data: data });
});

/**
 * @openapi
 * /metadata/years:
 *   get:
 *     summary: Earliest and latest accident year, overall and per state
 *     description: Directly answers "earliest accident year" questions for the whole dataset and per federal state.
 *     responses:
 *       200:
 *         description: Year coverage information
 */
app.get('/metadata/years', (req, res) => {
    const overall = db.prepare(`
        SELECT MIN(year) as earliest_year, MAX(year) as latest_year FROM accidents
    `).get();

    const byState = db.prepare(`
        SELECT r2.ags, r2.name, MIN(a.year) as earliest_year, MAX(a.year) as latest_year
        FROM accidents a
        JOIN regions r ON a.region_id = r.region_id
        JOIN regions r2 ON r2.ags = substr(r.ags, 1, 2) AND r2.level = 'state'
        GROUP BY r2.ags, r2.name
        ORDER BY r2.ags
    `).all();

    res.json({ overall, by_state: byState });
});
/**
 * @openapi
 * /aggregates/density:
 *   get:
 *     summary: Accident density per km² (cross-source, district level)
 *     description: Combines Unfallatlas accident counts with GV-ISys area data (Gemeindeverzeichnis) to compute accidents per square kilometer. Neither source alone can answer this.
 *     parameters:
 *       - in: query
 *         name: year
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, maximum: 500 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Accident density per district
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 year: { type: integer }
 *                 note: { type: string }
 *                 count: { type: integer }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/DensityRow' }
 *       400:
 *         description: Missing year parameter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
app.get('/aggregates/density', (req, res) => {
    const { year, limit, sort } = req.query;

    if (!year) {
        return res.status(400).json({ error: 'Bad Request', message: "Query parameter 'year' is required" });
    }

    const sortOrder = sort === 'asc' ? 'ASC' : 'DESC';
    const lim = limit ? Math.min(parseInt(limit), 500) : null;

    const query = `
        SELECT r.ags, r.name, r.area_km2,
               COUNT(a.accident_id) as accident_count,
               ROUND(COUNT(a.accident_id) / r.area_km2, 2) as accidents_per_km2
        FROM accidents a
        JOIN regions r ON a.region_id = r.region_id
        WHERE r.level = 'district' AND a.year = ? AND r.area_km2 IS NOT NULL
        GROUP BY r.ags, r.name, r.area_km2
        ORDER BY accidents_per_km2 ${sortOrder}
        ${lim ? 'LIMIT ' + lim : ''}
    `;

    const rows = db.prepare(query).all(parseInt(year));

    res.json({
        year: parseInt(year),
        note: 'accidents_per_km2 combines Unfallatlas (accidents) and GV-ISys Gemeindeverzeichnis (area) - cross-source aggregation',
        count: rows.length,
        data: rows
    });
});

// ============================================
// ERROR HANDLING (must be LAST)
// ============================================
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `The endpoint ${req.method} ${req.path} does not exist`,
        available_endpoints: [
            'GET /regions',
            'GET /accidents',
            'GET /aggregates/accidents',
            'GET /aggregates/rates',
            'GET /metadata/sources',
            'GET /metadata/years',
            'GET /api-docs',
            'GET /aggregates/density'
        ]
    });
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error', message: 'Something went wrong while processing your request' });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`API docs at http://localhost:${PORT}/api-docs`);
});