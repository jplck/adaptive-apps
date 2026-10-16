import { fireEvent, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { vi } from 'vitest';
import { Agent, AgentVersion } from '../api/client';
import { server } from '../mocks/server';
import { AgentReleases, defaultRelease } from '../routes/agents/AgentReleases';
import { renderWithProviders } from './testUtils';

const agent: Agent = {
  name: 'demo', type: 'prompt', activeVersion: null, requestedActiveVersion: null, endpoint: null,
};
const release = (version: string, status: AgentVersion['status'] = 'Available'): AgentVersion => ({
  name: 'demo', version, status, endpoint: `/agents/demo/versions/${version}/responses`,
  definitionDigest: null, active: false, requestedActive: false,
});

it('prefers the available effective release, then requested active', () => {
  const releases = [release('amber'), release('birch')];
  expect(defaultRelease({ ...agent, activeVersion: 'birch', requestedActiveVersion: 'amber' }, releases)).toBe('birch');
  expect(defaultRelease({ ...agent, requestedActiveVersion: 'birch' }, releases)).toBe('birch');
  expect(defaultRelease({ ...agent, activeVersion: 'unavailable', requestedActiveVersion: 'birch' }, releases)).toBe('birch');
});

it('selects the only Available candidate without active promotion', () => {
  expect(defaultRelease(agent, [release('candidate'), release('newer', 'Progressing')])).toBe('candidate');
  expect(agent.activeVersion).toBeNull();
});

it('uses explicit lexicographic release ordering, not inventory order or age', () => {
  expect(defaultRelease(agent, [release('zebra'), release('amber')])).toBe('amber');
  expect(defaultRelease(agent, [release('amber'), release('zebra')])).toBe('amber');
});

it('never falls back from an unavailable effective release or selects an endpointless candidate', () => {
  expect(defaultRelease({ ...agent, activeVersion: 'retired' }, [release('candidate')])).toBeUndefined();
  expect(defaultRelease(agent, [{ ...release('candidate'), endpoint: null }])).toBeUndefined();
});

it('shows a single selector without duplicating the active version or inventory', async () => {
  const onSelect = vi.fn();
  server.use(http.get('*/v1/agents/demo/versions', () => HttpResponse.json({ object: 'list', data: [
    { ...release('amber'), active: true },
    release('birch'),
    release('pending', 'Progressing'),
    { ...release('endpointless'), endpoint: null },
  ] })));
  renderWithProviders(<AgentReleases name="demo"
    agent={{ ...agent, activeVersion: 'amber', version: 'amber', endpoint: release('amber').endpoint }}
    disabled={false} onSelect={onSelect} />);

  const selector = screen.getByRole('combobox', { name: 'Version' });
  await screen.findByRole('option', { name: 'birch · Available' });
  expect(screen.getAllByRole('combobox')).toHaveLength(1);
  expect(screen.getAllByRole('option', { name: /amber/ })).toHaveLength(1);
  expect(selector).toHaveDisplayValue('amber · Active');
  expect(screen.getByRole('option', { name: 'pending · Progressing' })).toBeDisabled();
  expect(screen.getByRole('option', { name: 'endpointless · Available' })).toBeDisabled();
  expect(screen.queryByText(/Requested active:|Effective active:/)).not.toBeInTheDocument();
  fireEvent.change(selector, { target: { value: 'birch' } });
  expect(onSelect).toHaveBeenCalledWith('birch');
});

it('keeps an unavailable exact version visible and reports inventory errors', async () => {
  const onSelect = vi.fn();
  server.use(http.get('*/v1/agents/demo/versions', () => new HttpResponse(null, { status: 503 })));
  renderWithProviders(<AgentReleases name="demo" agent={agent} version="missing"
    disabled={false} onSelect={onSelect} />);

  expect(screen.getByRole('combobox', { name: 'Version' })).toHaveValue('missing');
  expect(screen.getByRole('option', { name: 'missing · unavailable' })).toBeDisabled();
  expect(await screen.findByRole('alert')).toHaveTextContent('Release inventory unavailable.');
  expect(screen.getByRole('combobox')).toBeDisabled();
  expect(onSelect).not.toHaveBeenCalled();
});
