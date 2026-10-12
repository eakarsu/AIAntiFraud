import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AIReportLibrary from './AIReportLibrary';
import features from './aiWorkspaceFeatures.json';

let container, root;
const response = (value) => Promise.resolve({ ok: true, json: () => Promise.resolve(value) });
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  localStorage.setItem('token', 'fixture-token'); global.fetch = jest.fn(() => response({ items: [] }));
});
afterEach(() => { act(() => root.unmount()); container.remove(); localStorage.clear(); delete global.fetch; });
const button = (text) => [...document.querySelectorAll('button')].find((item) => item.textContent.trim() === text);

test('the library exposes previously hidden features and presets fill all fields before one deliberate OpenRouter request', async () => {
  await act(async () => root.render(<AIReportLibrary />));
  act(() => container.querySelector('button').click());
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  const options = [...document.querySelectorAll('button')].filter((item) => item.textContent.includes('Open workspace →'));
  expect(options).toHaveLength(features.length);
  await act(async () => options[0].click());
  for (const label of ['Scenario', 'Data sample', 'Executive review']) {
    act(() => button(label).click());
    expect([...document.querySelectorAll('textarea, select, input')].every((input) => input.value.trim())).toBe(true);
    expect(global.fetch.mock.calls.filter(([, config]) => config.method === 'POST')).toHaveLength(0);
  }
  global.fetch.mockImplementation((_url, config) => config.method === 'POST' ? response({ item: { id: 'fixture', input: JSON.parse(config.body).fields, result: '## Findings\n\nReview the example.', model: 'fixture/provider' } }) : response({ items: [] }));
  await act(async () => button('Generate with OpenRouter').click());
  const calls = global.fetch.mock.calls.filter(([, config]) => config.method === 'POST');
  expect(calls).toHaveLength(1); expect(calls[0][0]).toContain('/api/report-workspace/run');
  expect(Object.keys(JSON.parse(calls[0][1].body).fields)).toHaveLength(10);
  expect(document.body.textContent).toContain('Review the example.'); expect(document.body.textContent).not.toContain('"choices"');
});

test('saved reports open centrally with Edit, Delete and Cancel; Escape closes only the top dialog', async () => {
  global.fetch.mockImplementation(() => response({ items: [{ id: 'fixture', input: { input: 'Example', goal: 'Review recommendations' }, result: '## Findings\n\nConfirm the supplied evidence.', model: 'fixture/provider', created_at: '2026-10-08T10:00:00Z' }] }));
  await act(async () => root.render(<AIReportLibrary />)); act(() => container.querySelector('button').click());
  await act(async () => [...document.querySelectorAll('button')].find((item) => item.textContent.includes('Open workspace →')).click());
  act(() => [...document.querySelectorAll('button')].find((item) => item.textContent.includes('Open report →')).click());
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2);
  const top = [...document.querySelectorAll('[role="dialog"]')].at(-1);
  expect(top.textContent).toContain('Edit'); expect(top.textContent).toContain('Delete'); expect(top.textContent).toContain('Cancel');
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1); expect(document.body.style.overflow).toBe('hidden');
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(0); expect(document.body.style.overflow).toBe('');
  expect(global.fetch.mock.calls.filter(([, config]) => config.method === 'DELETE')).toHaveLength(0);
});
