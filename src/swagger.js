const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'German Traffic Accident Data API',
            version: '1.0.0',
            description: 'API providing harmonised access to German road accident data (Unfallatlas) integrated with regional population statistics (Regionalstatistik) and area data (GV-ISys Gemeindeverzeichnis).'
        },
        servers: [{ url: 'http://localhost:3000', description: 'Local development server' }],
        components: {
            schemas: {
                Region: {
                    type: 'object',
                    properties: {
                        region_id: { type: 'integer', example: 14 },
                        ags: { type: 'string', example: '14' },
                        name: { type: 'string', example: 'Sachsen' },
                        level: { type: 'string', enum: ['state', 'district'] },
                        population: { type: 'integer', example: 4042422 },
                        area_km2: { type: 'number', example: 328.48, nullable: true }
                    }
                },
                Accident: {
                    type: 'object',
                    properties: {
                        accident_id: { type: 'integer' },
                        year: { type: 'integer', example: 2023 },
                        month: { type: 'integer' },
                        hour: { type: 'integer' },
                        weekday: { type: 'integer' },
                        category: { type: 'integer', description: '1=fatal, 2=serious, 3=light' },
                        is_pedestrian: { type: 'integer' },
                        is_bicycle: { type: 'integer' },
                        lon: { type: 'number' },
                        lat: { type: 'number' },
                        region_id: { type: 'integer' }
                    }
                },
                AggregateRow: {
                    type: 'object',
                    properties: {
                        ags: { type: 'string' },
                        name: { type: 'string' },
                        accident_count: { type: 'integer' }
                    }
                },
                RateRow: {
                    type: 'object',
                    properties: {
                        ags: { type: 'string' },
                        name: { type: 'string' },
                        population: { type: 'integer' },
                        accident_count: { type: 'integer' },
                        rate_per_100k: { type: 'number' }
                    }
                },
                DensityRow: {
                    type: 'object',
                    properties: {
                        ags: { type: 'string', example: '14612' },
                        name: { type: 'string', example: 'Dresden, kreisfreie Stadt' },
                        area_km2: { type: 'number', example: 328.48 },
                        accident_count: { type: 'integer', example: 4521 },
                        accidents_per_km2: { type: 'number', example: 13.76 }
                    }
                },
                ImportRun: {
                    type: 'object',
                    properties: {
                        import_id: { type: 'integer' },
                        source_name: { type: 'string' },
                        source_url: { type: 'string' },
                        imported_at: { type: 'string' },
                        row_count: { type: 'integer' },
                        license: { type: 'string' },
                        license_url: { type: 'string' }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                        message: { type: 'string' }
                    }
                }
            }
        }
    },
    apis: [path.join(__dirname, 'server.js')]
};

module.exports = swaggerJsdoc(swaggerOptions);