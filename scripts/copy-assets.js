/**
 * Minimal asset copy script to avoid gulp on modern Node versions.
 */
const { mkdirSync, copyFileSync } = require('fs');
const { join } = require('path');

const source = join(__dirname, '..', 'src', 'nodes', 'Mailwizz', 'mailwizz.svg');
const targetDir = join(__dirname, '..', 'dist', 'nodes', 'Mailwizz');
const target = join(targetDir, 'mailwizz.svg');

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
