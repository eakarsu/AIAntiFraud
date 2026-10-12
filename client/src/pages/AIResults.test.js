import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import api from '../api';
import AIResults from './AIResults';

jest.mock('../api', () => ({ get: jest.fn() }));

let container;
let root;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  api.get.mockImplementation((url) => {
    if (url === '/ai/results') return Promise.resolve({ data: { data: [{ id: 42, endpoint: 'network-analysis', entityType: 'platform', modelUsed: 'fixture/model', createdAt: '2026-10-10T12:00:00Z' }], pagination: { page: 1, totalPages: 1, total: 1 } } });
    if (url === '/ai/results/42') return Promise.resolve({ data: { aiResult: {
      id: 42,
      endpoint: 'network-analysis',
      entityType: 'platform',
      modelUsed: 'fixture/model',
      createdAt: '2026-10-10T12:00:00Z',
      result: JSON.stringify({ findings: [{ indicator: 'Shared device', severity: 'high', count: 4 }, { indicator: 'Rapid retries', severity: 'medium', count: 7 }], next_steps: ['Review evidence', 'Require analyst approval'] }),
    } } });
    return Promise.reject(new Error(`Unexpected URL ${url}`));
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllMocks();
});

test('saved JSON result detail uses the same professional sections and table renderer', async () => {
  await act(async () => root.render(<AIResults />));
  const view = [...container.querySelectorAll('button')].find(button => button.textContent.includes('View'));
  expect(view).toBeTruthy();
  await act(async () => view.click());

  expect(container.textContent).toContain('Stored AI Analysis');
  expect(container.textContent).toContain('Findings');
  expect(container.textContent).toContain('Next Steps');
  expect(container.querySelector('.ai-json-table')).toBeTruthy();
  expect(container.textContent).toContain('Shared device');
  expect(container.textContent).not.toContain('"indicator"');
});
