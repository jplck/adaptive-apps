import { queryOptions } from '@tanstack/react-query';
import { listModels } from '../../api/client';

export const modelsQueryOptions = queryOptions({
  queryKey: ['models'],
  queryFn: listModels,
  refetchInterval: (query) =>
    (query.state.data ?? []).some((model) => model.status === 'Provisioning') ? 5000 : false,
});
