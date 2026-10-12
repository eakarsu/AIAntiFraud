'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const authRouter = require('../routes/auth');

async function withServer(callback) {
  const app = express();
  app.use('/api/auth', authRouter);
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const { port } = server.address();
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

const keys = ['NODE_ENV', 'ENABLE_DEMO_CREDENTIAL_AUTOFILL', 'DEMO_EMAIL', 'DEMO_PASSWORD'];
const preserveEnvironment = () => Object.fromEntries(keys.map(key => [key, process.env[key]]));
const restoreEnvironment = saved => keys.forEach(key => saved[key] === undefined ? delete process.env[key] : process.env[key] = saved[key]);

test('demo credentials endpoint returns only an explicitly enabled complete local account', { concurrency: false }, async () => {
  const saved = preserveEnvironment();
  try {
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_DEMO_CREDENTIAL_AUTOFILL = 'true';
    process.env.DEMO_EMAIL = 'fixture.demo@antifraud.test';
    process.env.DEMO_PASSWORD = 'fixture-only-password';
    await withServer(async base => {
      const response = await fetch(`${base}/api/auth/demo-credentials`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.deepEqual(await response.json(), { email: process.env.DEMO_EMAIL, password: process.env.DEMO_PASSWORD });
    });
  } finally {
    restoreEnvironment(saved);
  }
});

test('demo credentials endpoint remains unavailable in production', { concurrency: false }, async () => {
  const saved = preserveEnvironment();
  try {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_DEMO_CREDENTIAL_AUTOFILL = 'true';
    process.env.DEMO_EMAIL = 'fixture.demo@antifraud.test';
    process.env.DEMO_PASSWORD = 'fixture-only-password';
    await withServer(async base => {
      const response = await fetch(`${base}/api/auth/demo-credentials`);
      assert.equal(response.status, 404);
    });
  } finally {
    restoreEnvironment(saved);
  }
});
