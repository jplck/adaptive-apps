import { Badge, Button, Card, Text } from '@fluentui/react-components';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getAgent } from '../../api/client';
import { AgentInfoPanel } from '../../components/AgentInfoPanel';
import { ImpersonationToggle } from '../../components/ImpersonationToggle';
import { useConnectivityFaultStore } from '../../state/connectivityFault';
import { useAgentConversation } from './useAgentConversation';
import { AgentPlaygroundTabs, AgentReleaseSelector } from './AgentPlaygroundShared';

export function HostedAgentPlayground(): JSX.Element {
  const { name = '' } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const version = search.get('version') || undefined;
  const agentQuery = useQuery({ queryKey: version ? ['agent', name, version] : ['agent', name], queryFn: () => getAgent(name, version), enabled: Boolean(name) });
  const mode = useConnectivityFaultStore((state) => state.enabled);
  const conversation = useAgentConversation(name, 'app', mode, version);
  const agent = conversation.pinned ?? agentQuery.data;

  return (
    <section className="page playground-page">
      <div className="playground-titlebar">
        <div className="playground-titlebar-group">
          <Button appearance="transparent" onClick={() => navigate('/agents')}>
            ← Agents
          </Button>
          <Text as="h1" size={500} weight="semibold">
            {agent?.name ?? name}
          </Text>
          <Badge appearance="tint">hosted</Badge>
        </div>
      </div>
      {agentQuery.error ? <Text className="error-text">Failed to load agent.</Text> : null}
      <div className="playground-shell three-pane">
        <aside className="playground-left">
          <Card appearance="filled-alternative" className="metadata-card">
            <ImpersonationToggle
              value="app"
              onChange={() => undefined}
              allowedModes={['app']}
            />
          </Card>
          <AgentReleaseSelector name={name} agent={agent} disabled={conversation.started} />
          <Card appearance="filled-alternative" className="metadata-card">
            <Text weight="semibold">Hosted metadata</Text>
            <Text size={200}>Hosted-agent tools are defined in the container’s code, not attached in this playground.</Text>
            <dl className="info-list">
              <div>
                <dt>Name</dt>
                <dd>{agent?.name ?? name}</dd>
              </div>
              <div>
                <dt>Image</dt>
                <dd>{agent?.image ?? '—'}</dd>
              </div>
              <div>
                <dt>Port</dt>
                <dd>{agent?.port ?? 8080}</dd>
              </div>
            </dl>
          </Card>
        </aside>
        <AgentPlaygroundTabs
          name={name}
          kind="hosted"
          version={version}
          agent={agent}
          placeholder="Message the hosted agent..."
          onSend={conversation.send}
          onReset={conversation.reset}
          disabled={conversation.failed || !agent || (!conversation.pinned && (!agent.endpoint || agent.phase !== 'Ready'))}
          className="hosted-main"
        />
        <aside className="playground-info">
          <AgentInfoPanel
            identity={agent?.identity}
            image={agent?.image}
            kind="hosted"
            protocol="responses"
          />
        </aside>
      </div>
    </section>
  );
}
