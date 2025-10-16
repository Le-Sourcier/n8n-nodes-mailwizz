const { rmSync } = require('fs');
const { join } = require('path');

rmSync(join(__dirname, '..', 'dist'), { recursive: true, force: true });
