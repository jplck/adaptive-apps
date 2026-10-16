import { Field, Select, Text } from '@fluentui/react-components';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Agent, AgentVersion, listAgentVersions } from '../../api/client';

export function defaultRelease(agent: Agent, releases: AgentVersion[]): string | undefined {
  const available = releases.filter((release) => release.status === 'Available' && release.endpoint);
  for (const version of [agent.activeVersion, agent.requestedActiveVersion]) {
    if (available.some((release) => release.version === version)) return version ?? undefined;
  }
  if (agent.activeVersion) return undefined;
  return available.map((release) => release.version).sort()[0];
}

export function AgentReleases({ name, agent, version, onSelect, disabled }: {
  name: string;
  agent?: Agent;
  version?: string;
  onSelect: (version: string) => void;
  disabled: boolean;
}): JSX.Element {
  const releases = useQuery({
    queryKey: ['agent-versions', name], queryFn: () => listAgentVersions(name), staleTime: 10_000,
  });
  useEffect(() => {
    if (!disabled && !version && agent && releases.data) {
      const selected = defaultRelease(agent, releases.data);
      if (selected && selected !== agent.activeVersion) onSelect(selected);
    }
  }, [agent, disabled, onSelect, releases.data, version]);
  const selected = version ?? agent?.activeVersion;
  const candidate = selected && selected !== agent?.activeVersion && selected !== agent?.requestedActiveVersion;
  return (
    <section aria-label="Agent version">
      <Field label={disabled ? 'Conversation version' : 'Version'}>
        <Select value={version ?? ''} disabled={disabled || !releases.data} onChange={(_, data) => onSelect(data.value)}>
          <option value="">{agent?.activeVersion ? `${agent.activeVersion} · Active` : 'No active version'}</option>
          {version && !releases.data?.some((release) => release.version === version)
            ? <option value={version} disabled>{version} · unavailable</option> : null}
          {releases.data?.filter((release) => release.version !== agent?.activeVersion || release.version === version).map((release) => <option key={release.version} value={release.version}
            disabled={release.status !== 'Available' || !release.endpoint}>
            {release.version} · {release.status}{release.active ? ' · Active' : release.requestedActive ? ' · Requested' : ''}
          </option>)}
        </Select>
      </Field>
      {!disabled && !agent?.activeVersion ? <Text block size={200}>No active version. Selection does not promote a release.</Text>
        : !disabled && !agent?.endpoint ? <Text block size={200}>Selected endpoint unavailable. No release fallback.</Text> : null}
      {!disabled && candidate ? <Text block size={200}>Candidate selected; no active promotion.</Text> : null}
      {disabled ? <Text block size={200}>Start a new conversation to change versions. Earlier messages are display-only, not model context.</Text> : null}
      {releases.error ? <Text role="alert">Release inventory unavailable.</Text> : null}
    </section>
  );
}
