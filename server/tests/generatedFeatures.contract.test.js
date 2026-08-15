'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FEATURES } = require('../routes/generatedFeatures');

test('every generated fraud page has an allowlisted backend feature', () => {
  const pagesDir = path.join(__dirname, '../../client/src/pages');
  const endpoints = fs.readdirSync(pagesDir)
    .filter((name) => /^(?:Cf|Gap).+\.js$/.test(name))
    .flatMap((name) => {
      const source = fs.readFileSync(path.join(pagesDir, name), 'utf8');
      return [...source.matchAll(/fetch\(['"]\/api\/([^'"]+)\/run['"]/g)].map((match) => match[1]);
    });

  assert.deepEqual([...new Set(endpoints)].sort(), Object.keys(FEATURES).sort());
});

test('generated feature registry is explicit and immutable', () => {
  assert.equal(Object.isFrozen(FEATURES), true);
  assert.equal(Object.keys(FEATURES).length, 13);
});
