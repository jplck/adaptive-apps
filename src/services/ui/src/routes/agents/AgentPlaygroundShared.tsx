import { Tab, TabList, TabValue } from '@fluentui/react-components';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Agent } from '../../api/client';
import { ChatPanel, SendChatArgs } from '../../components/ChatPanel';
import { MonitorPanel } from '../../components/MonitorPanel';
import { AgentGuardrails } from '../guardrails/Guardrails';
import { AgentReleases } from './AgentReleases';

export function AgentReleaseSelector({
  name,
  agent,
  disabled,
}: {
  name: string;
  agent?: Agent;
  disabled: boolean;
}): JSX.Element {
  const [search, setSearch] = useSearchParams();
  const version = search.get('version') || undefined;

  return (
    <AgentReleases
      name={name}
      agent={agent}
      version={version}
      disabled={disabled}
      onSelect={(selected) => setSearch((current) => {
        if (selected) current.set('version', selected);
        else current.delete('version');
        return current;
      })}
    />
  );
}

export function AgentPlaygroundTabs({
  name,
  kind,
  version,
  agent,
  placeholder,
  disabled,
  onSend,
  onReset,
  className = 'tabbed-main',
}: {
  name: string;
  kind: 'prompt' | 'hosted';
  version?: string;
  agent?: Agent;
  placeholder: string;
  disabled: boolean;
  onSend: (args: SendChatArgs) => Promise<void>;
  onReset: () => void;
  className?: string;
}): JSX.Element {
  const [tab, setTab] = useState<TabValue>('chat');

  return (
    <main className={`playground-main ${className}`}>
      <TabList selectedValue={tab} onTabSelect={(_, data) => setTab(data.value)}>
        <Tab value="chat">Chat</Tab>
        <Tab value="monitor">Monitor</Tab>
        <Tab value="guardrails">Guardrails</Tab>
      </TabList>
      <div hidden={tab !== 'chat'} className="tab-pane">
        <ChatPanel
          key={`${name}:${version ?? ''}`}
          emptyTitle={agent?.name ?? `${kind === 'prompt' ? 'Prompt' : 'Hosted'} agent`}
          emptySubtitle={agent?.description}
          placeholder={placeholder}
          onSend={onSend}
          onReset={onReset}
          disabled={disabled}
        />
      </div>
      <div hidden={tab !== 'monitor'} className="tab-pane">
        <MonitorPanel name={name} visible={tab === 'monitor'} />
      </div>
      <div hidden={tab !== 'guardrails'} className="tab-pane">
        <AgentGuardrails name={name} version={agent?.version ?? undefined} visible={tab === 'guardrails'} />
      </div>
    </main>
  );
}
