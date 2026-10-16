import { Badge, Spinner, Text } from '@fluentui/react-components';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getAgentGuardrails, PolicyResource } from '../../api/client';

function PolicyRules({ policy }: { policy: PolicyResource }): JSX.Element {
  return (
    <section className="guardrails-resource" aria-label={`Policy ${policy.reference}`}>
      <div className="guardrails-resource-heading">
        <Text weight="semibold">{policy.reference}</Text>
        <Badge appearance="tint" color="subtle">Default deny</Badge>
      </div>
      <div className="guardrails-table-wrap">
        <table className="guardrails-table" aria-label={`${policy.reference} rules`}>
          <thead>
            <tr>
              <th scope="col">Policy</th>
              <th scope="col">Rule</th>
              <th scope="col">Stage</th>
              <th scope="col">Condition</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {policy.bundle.policies.flatMap((definition) => definition.rules.map((rule) => (
              <tr key={`${definition.name}:${rule.name}`}>
                <td>
                  {definition.name}
                  <div className="muted-text">
                    {definition.mode ?? 'workload default'}
                  </div>
                </td>
                <td title={rule.description}>{rule.name}</td>
                <td>{rule.stage === 'pre_input' ? 'Model request' : 'Remote tool'}</td>
                <td><code>{rule.condition}</code></td>
                <td>
                  <Badge
                    size="small"
                    appearance="tint"
                    color={rule.action === 'allow' ? 'success' : 'warning'}
                  >
                    {rule.action}
                  </Badge>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function PlatformGuardrails(): JSX.Element {
  return (
    <section className="page guardrails-panel">
      <Text as="h1" size={600} weight="semibold">Guardrails</Text>
      <Text className="muted-text">
        Guardrails are shown for each agent.
      </Text>
      <Link to="/agents">View agents</Link>
    </section>
  );
}

export function AgentGuardrails({
  name,
  visible,
}: {
  name: string;
  visible: boolean;
}): JSX.Element {
  const query = useQuery({
    queryKey: ['agent-guardrails', name],
    queryFn: () => getAgentGuardrails(name),
    enabled: visible && Boolean(name),
  });
  const config = query.data;

  return (
    <section className="guardrails-panel" aria-label="Agent guardrails">
      <Text className="muted-text">
        Read-only configuration managed through Radius. Policies inspect outbound model and
        remote-tool input, not streamed output, and do not redact. Local functions and direct
        network bypass are outside this boundary. Cloud enforcement is separate.
        Catalogue configuration is not rollout evidence.
      </Text>
      {query.isLoading ? <Spinner label="Loading agent guardrails" /> : null}
      {query.error ? (
        <Text role="alert">Failed to load agent guardrails: {query.error.message}</Text>
      ) : null}
      {config ? (
        <>
          <div className="guardrails-summary">
            <Text weight="semibold">
              {config.name}
            </Text>
            <Badge appearance="tint" color={config.enabled ? 'success' : 'subtle'}>
              {config.enabled && config.attached ? 'Policy attached' : 'No policy attached'}
            </Badge>
            <Badge appearance="tint" color={config.enforcementVerified ? 'success' : 'warning'}>
              {config.enforcementVerified ? 'Enforcement verified' : 'Enforcement unverified'}
            </Badge>
            <Text size={200} className="muted-text">
              {config.deployment ?? 'Not deployed'} · {config.phase ?? 'Status unknown'}
            </Text>
          </div>
          {config.inherited.map((policy) => <PolicyRules key={policy.reference} policy={policy} />)}
          {config.attached ? (
            <PolicyRules policy={config.attached} />
          ) : (
            <Text className="muted-text">No agent-specific policy is attached to this agent.</Text>
          )}
          {config.policy_sha256 ? (
            <details className="guardrails-revision">
              <summary>Policy revision</summary>
              <code>{config.policy_sha256}</code>
            </details>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
