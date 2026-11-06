import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import LoginPage from './LoginPage.jsx';
import { AuthContext } from './auth-context.js';

function renderLogin(login) {
  return render(
    <AuthContext.Provider value={{ user: null, login }}>
      <MemoryRouter><LoginPage /></MemoryRouter>
    </AuthContext.Provider>,
  );
}

test('logs in with the typed credentials and shows a failure message', async () => {
  const login = vi.fn().mockRejectedValue(new Error('invalid email or password'));
  renderLogin(login);
  await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'password123');
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

  expect(login).toHaveBeenCalledWith('login', 'a@example.com', 'password123');
  expect(await screen.findByText('invalid email or password')).toBeInTheDocument();
});

test('can switch to sign up', async () => {
  const login = vi.fn().mockResolvedValue();
  renderLogin(login);
  await userEvent.click(screen.getByRole('button', { name: 'No account? Sign up' }));
  await userEvent.type(screen.getByLabelText('Email'), 'b@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'password123');
  await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
  expect(login).toHaveBeenCalledWith('register', 'b@example.com', 'password123');
});
