import {
  Badge,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  Spinner,
  TableColumnDefinition,
  Text,
  createTableColumn,
} from '@fluentui/react-components';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgentListEntry, listAgents } from '../../api/client';

const columns: TableColumnDefinition<AgentListEntry>[] = [
  createTableColumn<AgentListEntry>({
    columnId: 'name',
    renderHeaderCell: () => 'Name',
    renderCell: (agent) => <Text weight="semibold">{agent.name}</Text>,
  }),
  createTableColumn<AgentListEntry>({
    columnId: 'version',
    renderHeaderCell: () => 'Releases',
    renderCell: (agent) => <Text>{agent.releases.map((release) => `${release.version} · ${release.status}`).join(', ') || 'No captured releases'}</Text>,
  }),
  createTableColumn<AgentListEntry>({
    columnId: 'requested',
    renderHeaderCell: () => 'Requested active',
    renderCell: (agent) => agent.requestedActiveVersion ?? '—',
  }),
  createTableColumn<AgentListEntry>({
    columnId: 'effective',
    renderHeaderCell: () => 'Effective active',
    renderCell: (agent) => agent.activeVersion ?? '—',
  }),
  createTableColumn<AgentListEntry>({
    columnId: 'readiness',
    renderHeaderCell: () => 'Active readiness',
    renderCell: (agent) => agent.phase ?? 'Unknown',
  }),
  createTableColumn<AgentListEntry>({
    columnId: 'type',
    renderHeaderCell: () => 'Type',
    renderCell: (agent) => (
      <Badge appearance="filled" color={agent.type === 'prompt' ? 'brand' : 'important'}>
        {agent.type}
      </Badge>
    ),
  }),
  createTableColumn<AgentListEntry>({
    columnId: 'created',
    renderHeaderCell: () => 'Created',
    renderCell: (agent) => agent.created != null
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(agent.created * 1000))
      : '—',
  }),
  createTableColumn<AgentListEntry>({
    columnId: 'description',
    renderHeaderCell: () => 'Description',
    renderCell: (agent) => agent.description ?? '—',
  }),
];

export function AgentsList(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const agentsQuery = useQuery({ queryKey: ['agents'], queryFn: listAgents, refetchInterval: 10_000 });
  const agents = agentsQuery.data ?? [];
  useEffect(() => {
    for (const agent of agentsQuery.data ?? []) {
      queryClient.setQueryData(['agent', agent.name], agent);
      queryClient.setQueryData(['agent-versions', agent.name], agent.releases);
    }
  }, [agentsQuery.data, queryClient]);

  return (
    <section className="page agents-list-page">
      <div className="page-heading">
        <div className="page-heading-text">
          <Text as="h1" size={600} weight="semibold">Agents</Text>
          <Text className="muted-text">View and call agents here. Manage deployments through Radius.</Text>
        </div>
      </div>
      {agentsQuery.isLoading ? <Spinner label="Loading agents" /> : null}
      {agentsQuery.error ? <div className="error-text">Failed to load agents.</div> : null}
      <Text size={200} className="muted-text">
        Active readiness is qualified from native workload, state and ingress conditions.
        An Available release does not declare promotion. — means the API did not report a value.
      </Text>
      <DataGrid items={agents} columns={columns} getRowId={(item) => item.name} className="foundry-grid">
        <DataGridHeader>
          <DataGridRow>
            {({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}
          </DataGridRow>
        </DataGridHeader>
        <DataGridBody<AgentListEntry>>
          {({ item, rowId }) => (
            <DataGridRow<AgentListEntry>
              key={rowId}
              onClick={() => navigate(`/agents/${encodeURIComponent(item.name)}/${item.type}`)}
              className="clickable-row"
            >
              {({ renderCell }) => <DataGridCell>{renderCell(item)}</DataGridCell>}
            </DataGridRow>
          )}
        </DataGridBody>
      </DataGrid>
      <Text className="muted-text">{agents.length} agent{agents.length === 1 ? '' : 's'}</Text>
    </section>
  );
}
