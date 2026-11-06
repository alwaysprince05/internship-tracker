import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import ApplicationForm from './ApplicationForm.jsx';

test('sends empty link and notes as null and clears the form after adding', async () => {
  const onSave = vi.fn().mockResolvedValue();
  render(<ApplicationForm onSave={onSave} />);
  await userEvent.type(screen.getByPlaceholderText('Company'), 'Acme');
  await userEvent.type(screen.getByPlaceholderText('Role'), 'SWE Intern');
  await userEvent.click(screen.getByRole('button', { name: 'Add application' }));

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    company: 'Acme', role: 'SWE Intern', status: 'applied', link: null, notes: null,
  }));
  expect(onSave.mock.calls[0][0].applied_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(screen.getByPlaceholderText('Company')).toHaveValue('');
});

test('shows the error and keeps the input when saving fails', async () => {
  const onSave = vi.fn().mockRejectedValue(new Error('link: Invalid URL'));
  render(<ApplicationForm onSave={onSave} />);
  await userEvent.type(screen.getByPlaceholderText('Company'), 'Acme');
  await userEvent.type(screen.getByPlaceholderText('Role'), 'Intern');
  await userEvent.click(screen.getByRole('button', { name: 'Add application' }));

  expect(await screen.findByText('link: Invalid URL')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Company')).toHaveValue('Acme');
});

test('edit mode starts from the existing values', () => {
  render(<ApplicationForm initial={{ company: 'Acme', role: 'Intern', status: 'oa', applied_on: '2026-11-01', link: null, notes: null }} onSave={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByPlaceholderText('Company')).toHaveValue('Acme');
  expect(screen.getByRole('combobox')).toHaveValue('oa');
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
});
