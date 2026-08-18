# German Traffic Accident Data API

**DBW Project: Open Data Integration with Accidents in Germany**

A data integration platform combining German road accident data (Unfallatlas),
population statistics (Regionalstatistik), and area data (GV-ISys) into a
harmonised SQLite database, exposed through a documented REST API.

---

## 1. Technologies Used

| Component | Technology | Why |
|---|---|---|
| Runtime | Node.js | Simple, widely supported |
| Database | SQLite (better-sqlite3) | File-based, zero setup, fast for ~2M rows |
| API Framework | Express.js | Minimal REST framework |
| API Documentation | Swagger / OpenAPI 3.0 (swagger-jsdoc, swagger-ui-express) | Interactive, standard format |
| Frontend | Plain HTML/JS | No build tools needed for demo |

---

## 2. Setup Instructions

### Step 1 — Install dependencies

```bash
npm install
```

### Step 2 — Download source data

Download the following files and place them in the `data/` folder
(this folder is NOT included in the submission, since it can be reproduced
from these sources):

| File | Source | URL | Notes |
|---|---|---|---|
| `data/population_districts.csv` | Regionalstatistik, table 12411-01-01-4 | https://www.regionalstatistik.de/genesis/online?operation=table&code=12411-01-01-4 | **Requires free registration** (since May 2025). Download as Flat-File CSV (semicolon-separated), 31.12.2024. **This file IS included in the submission** (small, ~30KB, cannot be auto-downloaded without login). |
| `data/kreise_area.csv` | GV-ISys Gemeindeverzeichnis ("04-kreise") | https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/04-kreise.html | Free, no login. Download XLSX, save as CSV (semicolon-separated). |
| `data/accidents_<YEAR>.csv` (for YEAR = 2016..2024) | Unfallatlas | https://www.opengeodata.nrw.de/produkte/transport_verkehr/unfallatlas/ | Free, no login. Download "Unfallorte<YEAR>_EPSG25832_CSV.zip", unzip, rename CSV. |

### Step 3 — Initialise database and run ETL scripts (in order)

```bash
# 1. Seed the 16 federal states (reference data)
node etl/seed_states.js

# 2. Import population + district AGS codes (Source: Regionalstatistik)
node etl/import_population.js

# 3. Add area column and import area data (Source: GV-ISys)
node etl/migrate_add_area.js
node etl/import_area.js

# 4. Import accident data for each year (Source: Unfallatlas)
node etl/import_accidents.js 2016 data/accidents_2016.csv
node etl/import_accidents.js 2017 data/accidents_2017.csv
node etl/import_accidents.js 2018 data/accidents_2018.csv
node etl/import_accidents.js 2019 data/accidents_2019.csv
node etl/import_accidents.js 2020 data/accidents_2020.csv
node etl/import_accidents.js 2021 data/accidents_2021.csv
node etl/import_accidents.js 2022 data/accidents_2022.csv
node etl/import_accidents.js 2023 data/accidents_2023.csv
node etl/import_accidents.js 2024 data/accidents_2024.csv

# 5. (Optional) Export API documentation to docs/swagger.json
node etl/export_docs.js
```

All import scripts are **idempotent** — they delete and re-insert their own
data before importing, so they can be safely re-run (e.g., when new yearly
data is released).

### Step 4 — Start the server

```bash
node src/server.js
```

The server starts at **http://localhost:3000**

- **Demo client (frontend):** http://localhost:3000
- **Interactive API docs (Swagger UI):** http://localhost:3000/api-docs
- **Raw OpenAPI spec:** http://localhost:3000/api-docs.json

---

## 3. Database Schema (overview)

| Table | Purpose |
|---|---|
| `regions` | States and districts: AGS code, name, population, area (km²) |
| `accidents` | Individual accident records (year, time, category, participants, coordinates, region) |
| `import_runs` | Provenance log: source, URL, retrieval timestamp, row count, license |

See `src/init.sql` for full definitions and indexes.

---

## 4. API Endpoints

| Method & Path | Description |
|---|---|
| `GET /regions` | List states/districts, optional `?level=state\|district` |
| `GET /accidents` | Filtered accident list (`state`, `region`, `year`, `month`, `weekday`, `hour`, `category`, `pedestrian`, `bicycle`, `limit`, `offset`) |
| `GET /aggregates/accidents` | Counts grouped by `level=state\|district`, optional `year`, `category`, `state` |
| `GET /aggregates/rates` | Accidents per 100,000 inhabitants (cross-source: Unfallatlas + Regionalstatistik) |
| `GET /aggregates/density` | Accidents per km² (cross-source: Unfallatlas + GV-ISys) |
| `GET /metadata/years` | Earliest/latest accident year, overall and per state |
| `GET /metadata/sources` | Provenance log + data licenses |

Full parameter/response documentation: see `/api-docs` (Swagger UI) or `docs/swagger.json`.

---

## 5. Data Sources & Licenses

All datasets are published under **"Datenlizenz Deutschland – Namensnennung – Version 2.0"**
(https://www.govdata.de/dl-de/by-2-0). This license is also returned by the
`/metadata/sources` endpoint with every provenance entry.

| # | Source | What it provides |
|---|---|---|
| 1 | Unfallatlas (opengeodata.nrw.de) | Accident records 2016-2024 |
| 2 | Regionalstatistik (table 12411-01-01-4) | Population per state/district |
| 3 | GV-ISys Gemeindeverzeichnis ("04-kreise") | Area (km²) per district |

---

## 6. Known Limitations / Data Quality Notes

- **Berlin and Hamburg boroughs:** Unfallatlas reports accidents at borough
  level (e.g. Berlin's 12 Bezirke, codes 11001-11012), but `regions` only has
  these city-states at the state level. Accidents for these boroughs are
  mapped to the parent city-state (`ags='11'` / `ags='02'`) via a fallback in
  `getRegionId()`.
- **NRW and Mecklenburg-Vorpommern earliest data:** `/metadata/years` shows
  NRW data from 2019 and MV from 2020, not 2016 — the Unfallatlas expanded
  state coverage gradually after its 2016 launch.
- **Area coverage:** 398 of 416 district entries have area data (95.7%).
  The remaining 18 are non-standard supplementary entries from the
  population source (e.g. Berlin's boroughs with 8-digit codes, Saxony's
  "Statistische Regionen", "Region Hannover") that do not correspond to
  standard 5-digit Kreis-AGS codes used by Unfallatlas, and therefore have
  zero linked accidents and no area data.
- **Encoding:** Source CSVs from Regionalstatistik/GV-ISys use
  Windows-1252/Latin-1 encoding; import scripts read these files with
  `latin1` encoding to preserve German umlauts correctly.

---

## 7. Reproducibility

Every import script logs a row to `import_runs` with source name, URL,
timestamp, and row count — visible via `GET /metadata/sources`. Re-running
any import script is safe (old data for that source/year is deleted before
re-insertion).