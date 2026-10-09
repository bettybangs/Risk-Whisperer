import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App, { SOC2_CONTROLS } from './App';
import { SOC2_GROUNDED_DEFINITIONS } from '../api/_prompts';

afterEach(() => {
  delete global.fetch;
  localStorage.clear();
});

test('renders Risk Whisperer with SOC 2 Type I and Type II', () => {
  render(<App />);
  const options = screen.getAllByRole('option').map((o) => o.value);
  expect(options).toEqual(expect.arrayContaining(['SOC 2 Type I', 'SOC 2 Type II']));
  expect(screen.getAllByText(/Risk Whisperer/i).length).toBeGreaterThan(0);
});

test('sends only data to the server and shows weak-fit flags and verified labels', async () => {
  const assessment = {
    assessmentQuestions: ['q1'],
    evidenceToCollect: ['e1'],
    potentialWeaknesses: [{ name: 'Weak', description: 'd', severity: 'High', recommendation: 'r' }],
    controlMappings: [
      { id: 'CC6.1', name: 'Logical access', rationale: 'Original rationale.' },
      { id: 'CC9.9', name: 'Made up', rationale: 'Original rationale 2.' }
    ],
    overallRiskScore: 4,
    riskJustification: 'rj',
    controlMaturity: 'Defined',
    maturityJustification: 'mj'
  };
  const judgments = [
    { id: 'CC6.1', relevant: true, rationale: 'Grounded rationale.', verified: true },
    { id: 'CC9.9', relevant: false, rationale: 'Not described.', verified: false }
  ];
  global.fetch = jest.fn((url) => Promise.resolve({
    json: () => Promise.resolve(url === '/api/assess' ? { result: assessment } : { judgments })
  }));

  render(<App />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Our AWS environment uses IAM roles with least-privilege policies and MFA.' } });
  fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'SOC 2 Type II' } });
  fireEvent.click(screen.getByText('Assess control'));

  await screen.findByText(/SOC 2 Type II control mappings/i);
  const [assessCall, judgeCall] = global.fetch.mock.calls;
  expect(assessCall[0]).toBe('/api/assess');
  expect(Object.keys(JSON.parse(assessCall[1].body)).sort()).toEqual(['env', 'family', 'framework', 'input']);
  expect(judgeCall[0]).toBe('/api/judge');
  expect(Object.keys(JSON.parse(judgeCall[1].body)).sort()).toEqual(['controlMappings', 'framework', 'input']);

  fireEvent.click(screen.getByText(/SOC 2 Type II control mappings/i));
  await waitFor(() => expect(screen.getByText(/Grounded rationale\./)).toBeInTheDocument());
  expect(screen.getByText(/Weak fit: Not described\./)).toHaveTextContent('(judged without a verified definition)');
  expect(screen.getByText('Control name verified · explanation AI-generated')).toBeInTheDocument();
  expect(screen.getByText('Control name AI-generated, not yet verified against source')).toBeInTheDocument();

  // The copied text for the mappings card has no em-dash.
  const writeText = jest.fn();
  Object.assign(navigator, { clipboard: { writeText } });
  fireEvent.click(screen.getByText('Copy'));
  const copied = writeText.mock.calls[0][0];
  expect(copied).toContain('CC9.9 - Made up: Original rationale 2. (Weak fit: Not described., judged without a verified definition)');
  expect(copied).not.toContain('\u2014');
});

test('every SOC 2 criterion with a definition has a display name', () => {
  const missing = Object.keys(SOC2_GROUNDED_DEFINITIONS).filter((id) => !SOC2_CONTROLS[id]);
  expect(missing).toEqual([]);
  expect(Object.keys(SOC2_GROUNDED_DEFINITIONS)).toHaveLength(61);
});
