'use strict';
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
if (process.env.CONFIRM_DEMO_SEED !== 'yes') throw new Error('Refusing demo seed without CONFIRM_DEMO_SEED=yes');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const result = spawnSync('psql', [process.env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-f', join(__dirname, '..', 'seed.sql')], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
