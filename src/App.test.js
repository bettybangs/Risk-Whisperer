import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Risk Whisperer with SOC 2 Type I and Type II', () => {
  render(<App />);
  const options = screen.getAllByRole('option').map((o) => o.value);
  expect(options).toEqual(expect.arrayContaining(['SOC 2 Type I', 'SOC 2 Type II']));
  expect(screen.getAllByText(/Risk Whisperer/i).length).toBeGreaterThan(0);
});
