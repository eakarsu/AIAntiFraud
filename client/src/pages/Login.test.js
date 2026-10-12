import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import api from '../api';
import Login from './Login';

jest.mock('../api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../App', () => ({ useAuth: () => ({ login: jest.fn() }) }));

let container;
let root;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  delete process.env.REACT_APP_DEMO_EMAIL;
  delete process.env.REACT_APP_DEMO_PASSWORD;
  api.get.mockResolvedValue({ data: { email: 'fixture.demo@antifraud.test', password: 'fixture-only-password' } });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllMocks();
});

test('Fill Demo Credentials fills both login fields without bypassing the normal sign-in action', async () => {
  await act(async () => root.render(<MemoryRouter><Login /></MemoryRouter>));
  const fill = [...container.querySelectorAll('button')].find(button => button.textContent === 'Fill Demo Credentials');
  expect(fill).toBeTruthy();
  await act(async () => fill.click());

  expect(api.get).toHaveBeenCalledWith('/auth/demo-credentials');
  expect(container.querySelector('input[type="email"]').value).toBe('fixture.demo@antifraud.test');
  expect(container.querySelector('input[type="password"]').value).toBe('fixture-only-password');
  expect(api.post).not.toHaveBeenCalled();
});
