import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { AgentGuardrails } from '../routes/guardrails/Guardrails';
import { renderWithProviders } from './testUtils';
import { App } from '../App';

const bundle = {
  policies: [{
    apiVersion: 'governance.toolkit/v1', name: 'baseline', default_action: 'deny',
    rules: [{
      name: 'responses-only', stage: 'pre_input', condition: "action == 'responses'",
      action: 'allow', description: '',
    }],
  }],
};
const platform = { reference: 'platform-ref', namespace: 'adaptive-guardrails-platform', targets: ['adaptive/*'], bundle };
const attached = { reference: 'application-ref', namespace: 'adaptive-guardrails-apps', targets: [], bundle: { policies: [{ ...bundle.policies[0], name: 'extra' }] } };

describe('Guardrails', () => {
  it('links guardrails to per-agent release views instead of listing global policies', async () => {
    let globalCalls = 0;
    server.use(http.get('*/v1/guardrails', () => {
      globalCalls += 1;
      return HttpResponse.json({ enabled: true, mode: 'enforce', policies: [platform] });
    }));
    renderWithProviders(<App />, { route: '/guardrails' });
    expect(screen.getByRole('link', { name: 'Guardrails' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Guardrails are shown for each agent release.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View agents' })).toHaveAttribute('href', '/agents');
    expect(screen.queryByText(/Global policies|Platform-owned|baseline/)).not.toBeInTheDocument();
    expect(globalCalls).toBe(0);
  });

  it('shows concise agent release policy details without inherited global policies', async () => {
    server.use(http.get('*/v1/agents/demo/guardrails', () => HttpResponse.json({
      name: 'demo', version: '1', enabled: true, mode: 'audit',
      inherited: [platform], attached, policy_sha256: 'digest',
      deployment: 'demo-v1', phase: 'Available',
    })));
    renderWithProviders(<AgentGuardrails name="demo" visible />);
    expect(await screen.findByText('application-ref')).toBeInTheDocument();
    expect(screen.getByText('demo · v1')).toBeInTheDocument();
    expect(screen.getByText('Policy attached')).toBeInTheDocument();
    expect(screen.getByText('Enforcement unverified')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'application-ref rules' })).toBeInTheDocument();
    expect(screen.getByText('responses-only')).toBeInTheDocument();
    expect(screen.queryByText('platform-ref')).not.toBeInTheDocument();
    expect(screen.queryByText('Inherited platform policies')).not.toBeInTheDocument();
    expect(screen.queryByText(/Matching platform policies|PII and prompt-injection|Cloud enforcement/)).not.toBeInTheDocument();
  });

  it('shows a compact state when a release has no attached policy', async () => {
    server.use(http.get('*/v1/agents/demo/guardrails', () => HttpResponse.json({
      name: 'demo', version: '1', enabled: false, mode: null, enforcementVerified: false,
      inherited: [], attached: null, policy_sha256: null,
      deployment: 'demo-v1', phase: 'Available',
    })));
    renderWithProviders(<AgentGuardrails name="demo" visible />);
    expect(await screen.findByText('No policy attached')).toBeInTheDocument();
    expect(screen.getByText('No agent-specific policy is attached to this release.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the declared policy mode in the flat rules table', async () => {
    server.use(http.get('*/v1/agents/demo/guardrails', () => HttpResponse.json({
      name: 'demo', version: '1', enabled: true, mode: null, enforcementVerified: false,
      inherited: [], attached: {
        ...attached,
        bundle: { policies: [{ ...bundle.policies[0], mode: 'audit' }] },
      }, policy_sha256: null, deployment: 'demo-v1', phase: 'Available',
    })));
    renderWithProviders(<AgentGuardrails name="demo" visible />);
    expect(await screen.findByText('application-ref')).toBeInTheDocument();
    expect(screen.getByText('audit')).toBeInTheDocument();
  });

  it('reports unresolved configuration, not an inactive success', async () => {
    server.use(http.get('*/v1/agents/demo/guardrails', () =>
      HttpResponse.json({ detail: 'Unknown agent governance bundle: missing' }, { status: 409 })));
    renderWithProviders(<AgentGuardrails name="demo" visible />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load agent guardrails');
    expect(screen.queryByText('No guardrails attached')).not.toBeInTheDocument();
  });
});
