import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AIResultsDisplay from './AIResultsDisplay';

let container;
let root;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const fixture = {
  executive_summary: 'Two coordinated signals require analyst review.',
  risk_assessment: { overall_risk: 'high', score: 82, review_required: true },
  recommended_actions: [
    { action: 'Verify account ownership', priority: 'high', owner: 'Fraud operations' },
    { action: 'Review linked devices', priority: 'medium', owner: 'Risk analyst' },
  ],
  evidence: ['Shared device fingerprint', 'Three merchants in 24 hours'],
};

test('returned JSON uses labeled sections, nested facts, lists, and a table instead of a raw JSON dump', () => {
  act(() => root.render(<AIResultsDisplay data={{ analysis: JSON.stringify(fixture) }} title="Returned Fraud Analysis" />));

  expect(container.querySelector('.ai-results')).toBeTruthy();
  expect(container.textContent).toContain('Executive Summary');
  expect(container.textContent).toContain('Overall Risk');
  expect(container.textContent).toContain('Recommended Actions');
  expect(container.textContent).toContain('Shared device fingerprint');
  expect(container.querySelector('.ai-json-table')).toBeTruthy();
  expect([...container.querySelectorAll('th')].map(item => item.textContent)).toEqual(['Action', 'Priority', 'Owner']);
  expect(container.textContent).not.toContain('"executive_summary"');
});
