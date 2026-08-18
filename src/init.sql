-- ============================================
-- TABLE 1: regions
-- Stores German administrative regions
-- (states, districts, municipalities)
-- ============================================
CREATE TABLE IF NOT EXISTS regions (
    region_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    ags         TEXT UNIQUE,        -- Official region key (Amtlicher Gemeindeschlüssel)
    name        TEXT NOT NULL,      -- e.g. "Sachsen", "Dresden"
    level       TEXT NOT NULL,      -- 'state', 'district', or 'municipality'
    population  INTEGER             -- number of inhabitants (for rate calculations)
    area_km2    REAL
);

-- ============================================
-- TABLE 2: accidents
-- Stores individual accident records
-- ============================================
CREATE TABLE IF NOT EXISTS accidents (
    accident_id INTEGER PRIMARY KEY AUTOINCREMENT,
    year        INTEGER NOT NULL,   -- e.g. 2023
    month       INTEGER,            -- 1-12
    hour        INTEGER,            -- 0-23
    weekday     INTEGER,            -- 1-7
    category    INTEGER,            -- accident severity category (1=fatal, 2=serious, 3=minor)
    is_pedestrian INTEGER,          -- 1 = pedestrian involved, 0 = not
    is_bicycle    INTEGER,          -- 1 = bicycle involved, 0 = not
    lon         REAL,               -- longitude (GPS)
    lat         REAL,               -- latitude (GPS)
    region_id   INTEGER,            -- links to regions table
    FOREIGN KEY (region_id) REFERENCES regions(region_id)
);

-- ============================================
-- TABLE 3: import_runs (provenance tracking)
-- Records when/where data was imported from
-- ============================================
CREATE TABLE IF NOT EXISTS import_runs (
    import_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT NOT NULL,      -- e.g. "Unfallatlas 2023"
    source_url  TEXT,               -- where it came from
    imported_at TEXT,               -- timestamp
    row_count   INTEGER             -- how many rows were imported
);

-- ============================================
-- INDEXES (make queries fast)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_accidents_year ON accidents(year);
CREATE INDEX IF NOT EXISTS idx_accidents_region ON accidents(region_id);
CREATE INDEX IF NOT EXISTS idx_accidents_category ON accidents(category);