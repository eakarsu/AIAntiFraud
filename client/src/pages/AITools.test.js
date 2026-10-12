import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import api from '../api';
import AITools from './AITools';

jest.mock('../api', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

let container;
let root;

const records = {
  '/transactions': [
    { id: 'txn-101', userId: 11 },
    { id: 'txn-202', userId: 22 },
    { id: 'txn-303', userId: 33 },
  ],
  '/credit-scores': [{ id: 'credit-101' }, { id: 'credit-202' }, { id: 'credit-303' }],
  '/behavioral-patterns': [
    { id: 'pattern-101', customerId: 'customer-101' },
    { id: 'pattern-202', customerId: 'customer-202' },
    { id: 'pattern-303', customerId: 'customer-303' },
  ],
  '/merchant-profiles': [{ id: 'merchant-101' }, { id: 'merchant-202' }, { id: 'merchant-303' }],
};

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  api.get.mockImplementation((endpoint) => Promise.resolve({ data: { data: records[endpoint] } }));
  api.post.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllMocks();
});

const clickButton = (text) => {
  const item = [...container.querySelectorAll('button')].find(button => button.textContent.trim() === text);
  expect(item).toBeTruthy();
  act(() => item.click());
};

const selectTool = (label) => {
  const item = [...container.querySelectorAll('[data-ai-tool]')].find(element => element.textContent.includes(label));
  expect(item).toBeTruthy();
  act(() => item.click());
};

const editableInputs = () => [...container.querySelectorAll('form input:not([disabled]), form textarea:not([disabled]), form select:not([disabled])')];

test('every AI Tools preset fills every visible field from controlled real-record fixtures without submitting', async () => {
  await act(async () => root.render(<AITools />));
  await act(async () => { await Promise.resolve(); });

  const toolsWithFields = [
    'Analyze Transaction', 'Credit Assessment', 'Behavioral Analysis', 'Merchant Screening',
    'Fraud Ring Network', 'Customer 360', 'Velocity Rules', 'Money Mule Detection',
    'ML Rule Tuning', 'Graph Anomaly', 'Cross-Merchant Rings',
  ];
  const presets = ['Low-risk review', 'Elevated-risk review', 'Fraud-ring review'];

  for (const tool of toolsWithFields) {
    selectTool(tool);
    for (const preset of presets) {
      clickButton(`Demo AI · ${preset}`);
      const fields = editableInputs();
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.every(field => String(field.value).trim())).toBe(true);
    }
  }

  selectTool('Analyze Transaction');
  clickButton('Demo AI · Elevated-risk review');
  expect(editableInputs()[0].value).toBe('txn-202');
  expect(api.post).not.toHaveBeenCalled();
});
