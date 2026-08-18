const fs = require('fs');
const path = require('path');
const swaggerSpec = require('../src/swagger');

const outputPath = path.join(__dirname, '..', 'docs', 'swagger.json');
fs.writeFileSync(outputPath, JSON.stringify(swaggerSpec, null, 2));

console.log(`✅ Exported to ${outputPath}`);