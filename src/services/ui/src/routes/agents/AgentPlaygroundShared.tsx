import { Tab, TabList, TabValue } from '@fluentui/react-components';
import { useState } from 'react';
import { embeddedMode } from '../../auth/config';
import { Agent } from '../../api/client';
import { ChatPanel, SendChatArgs } from '../../components/ChatPanel';
import { MonitorPanel } from '../../components/MonitorPanel';
import { AgentGuardrails } from '../guardrails/Guardrails';
import { A2APanel } from './A2APanel';

export function AgentPlaygroundTabs({
  name,
  kind,
  agent,
  placeholder,
  disabled,
  onSend,
  onReset,
  className = 'tabbed-main',
}: {
  name: string;
  kind: 'prompt' | 'hosted';
  agent?: Agent;
  placeholder: string;
  disabled: boolean;
  onSend: (args: SendChatArgs) => Promise<void>;
  onReset: () => void;
  className?: string;
}): JSX.Element {
  const [tab, setTab] = useState<TabValue>('chat');
  const embedded = embeddedMode();

  return (
    <main className={`playground-main ${className}`}>
      <TabList selectedValue={tab} onTabSelect={(_, data) => setTab(data.value)}>
        <Tab value="chat">Chat</Tab>
        <Tab value="monitor">Monitor</Tab>
        {!embedded ? <Tab value="guardrails">Guardrails</Tab> : null}
        {!embedded ? <Tab value="a2a">A2A</Tab> : null}
      </TabList>
      <div hidden={tab !== 'chat'} className="tab-pane">
        <ChatPanel
          key={name}
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
      {!embedded ? <div hidden={tab !== 'guardrails'} className="tab-pane">
        <AgentGuardrails name={name} visible={tab === 'guardrails'} />
      </div> : null}
      {!embedded ? <div hidden={tab !== 'a2a'} className="tab-pane"><A2APanel name={name} visible={tab === 'a2a'} /></div> : null}
    </main>
  );
}
