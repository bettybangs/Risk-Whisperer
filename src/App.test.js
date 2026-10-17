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

test('SOC 2 control IDs are paired with the right category name', () => {
  const prefixToCategory = [
    [/^CC3\./, 'Risk Assessment'],
    [/^CC6\./, 'Logical & Physical Access'],
    [/^A1\./, 'Availability'],
    [/^C1\./, 'Confidentiality'],
    [/^PI1\./, 'Processing Integrity'],
    [/^P\d/, 'Privacy']
  ];
  const wrong = [];
  Object.keys(SOC2_CONTROLS).forEach((id) => {
    prefixToCategory.forEach(([pattern, category]) => {
      if (pattern.test(id) && !SOC2_CONTROLS[id].startsWith(category + ':')) wrong.push(id);
    });
  });
  expect(wrong).toEqual([]);
  // The reported bug: A1.2 was labeled "Risk Assessment".
  expect(SOC2_CONTROLS['A1.2']).toMatch(/^Availability:/);
});

// ---- control ID validation display ----

const BASE_RESULT = {
  assessmentQuestions: ['q1'],
  evidenceToCollect: ['e1'],
  potentialWeaknesses: [{ name: 'Weak', description: 'd', severity: 'High', recommendation: 'r' }],
  overallRiskScore: 4,
  riskJustification: 'rj',
  controlMaturity: 'Defined',
  maturityJustification: 'mj'
};

async function runAssessment(framework, result) {
  global.fetch = jest.fn((url) => Promise.resolve({
    json: () => Promise.resolve(url === '/api/assess' ? { result } : { judgments: [] })
  }));
  render(<App />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Our AWS environment forwards logs to a central workspace.' } });
  fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: framework } });
  fireEvent.click(screen.getByText('Assess control'));
  const title = await screen.findByText(new RegExp(framework + ' control mappings', 'i'));
  fireEvent.click(title);
}

test('ISO draft list: unverified IDs are flagged, listed IDs say pending, nothing says Verified, model names are kept', async () => {
  await runAssessment('ISO 27001:2022', {
    ...BASE_RESULT,
    controlMappings: [
      { id: 'A.5.3', name: 'Model name for A.5.3', rationale: 'Roles are split.' },
      { id: 'A.12.4.1', name: 'Event logging', rationale: 'Logs are kept.' }
    ],
    validation: {
      frameworkId: 'ISO 27001:2022', hasList: true, listStatus: 'draft', banner: null,
      controls: [{ id: 'A.5.3', status: 'listed' }, { id: 'A.12.4.1', status: 'unverified' }]
    }
  });
  expect(screen.getAllByText('⚠ Unverified ID')).toHaveLength(1);
  expect(screen.getAllByText('ID list pending verification')).toHaveLength(1);
  expect(screen.getByText(/Model name for A\.5\.3/)).toBeInTheDocument();
  expect(screen.queryByText(/verified ·|^Verified$|ID verified/i)).toBeNull();
  expect(screen.queryByText(/not validated/i)).toBeNull();

  const writeText = jest.fn();
  Object.assign(navigator, { clipboard: { writeText } });
  fireEvent.click(screen.getByText('Copy'));
  const copied = writeText.mock.calls[0][0];
  expect(copied).toContain('A.12.4.1 - Event logging: Logs are kept. [Unverified ID]');
  expect(copied).not.toContain('A.5.3 - Model name for A.5.3: Roles are split. [Unverified ID]');
});

test('a framework with no list shows the whole-result banner and no per-control tags', async () => {
  await runAssessment('PCI DSS v4.0', {
    ...BASE_RESULT,
    controlMappings: [{ id: '8.3', name: 'Strong authentication', rationale: 'MFA is enforced.' }],
    validation: {
      frameworkId: 'PCI DSS v4.0', hasList: false, listStatus: null,
      banner: 'AI-generated, verify control IDs before use.',
      controls: [{ id: '8.3', status: 'unchecked' }]
    }
  });
  expect(screen.getByRole('note')).toHaveTextContent('AI-generated, verify control IDs before use.');
  expect(screen.queryByText(/Unverified ID/)).toBeNull();
  expect(screen.queryByText(/pending verification/)).toBeNull();

  const writeText = jest.fn();
  Object.assign(navigator, { clipboard: { writeText } });
  fireEvent.click(screen.getByText('Copy'));
  expect(writeText.mock.calls[0][0].startsWith('AI-generated, verify control IDs before use.')).toBe(true);
});

test('SOC 2 keeps its existing labels and gets no new Verified wording; an ID not on the list is flagged', async () => {
  await runAssessment('SOC 2 Type II', {
    ...BASE_RESULT,
    controlMappings: [
      { id: 'CC6.1', name: 'Logical access', rationale: 'MFA is enforced.' },
      { id: 'PI1.1', name: 'Processing objectives', rationale: 'Specs are defined.' },
      { id: 'CC6.99', name: 'Made up', rationale: 'Invented.' }
    ],
    validation: {
      frameworkId: 'SOC 2', hasList: true, listStatus: 'verified', banner: null,
      controls: [{ id: 'CC6.1', status: 'listed' }, { id: 'PI1.1', status: 'listed' }, { id: 'CC6.99', status: 'unverified' }]
    }
  });
  // Existing behavior, unchanged: CC6.1 and PI1.1 have display names, CC6.99 does not.
  expect(screen.getAllByText('Control name verified · explanation AI-generated')).toHaveLength(2);
  expect(screen.getAllByText('Control name AI-generated, not yet verified against source')).toHaveLength(1);
  expect(screen.getAllByText('⚠ Unverified ID')).toHaveLength(1);
  expect(screen.queryByText(/pending verification/)).toBeNull();
});

test('a saved history entry without validation shows "not validated"', async () => {
  localStorage.setItem('rw-history', JSON.stringify([{
    input: 'Old input...', env: 'AWS', framework: 'ISO 27001:2022', timestamp: '1:00 PM',
    result: { ...BASE_RESULT, controlMappings: [{ id: 'A.12.4.1', name: 'Event logging', rationale: 'Logs are kept.' }] }
  }]));
  render(<App />);
  fireEvent.click(screen.getByText('History (1)'));
  fireEvent.click(screen.getByText('Old input...'));
  fireEvent.click(await screen.findByText(/ISO 27001:2022 control mappings/i));
  expect(screen.getByRole('note')).toHaveTextContent('Control IDs not validated');
  expect(screen.queryByText(/Unverified ID|pending verification/)).toBeNull();
});
