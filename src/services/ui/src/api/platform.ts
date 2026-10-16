import { z } from 'zod';
import { requestJson, sendJson } from './transport';

export const EnvironmentCloudConfigSchema = z.object({
  enabled: z.boolean(),
  foundryProjectEndpoint: z.string().nullish(),
  foundryProjectArmId: z.string().nullish(),
});

export const EnvironmentSchema = z.object({
  name: z.string(),
  description: z.string().nullish(),
  cloud: EnvironmentCloudConfigSchema,
});

export const ConnectivityFaultStateSchema = z.object({
  enabled: z.boolean(),
  policyName: z.literal('demo-cloud-egress'),
  namespace: z.string(),
});

export const ConnectivityFaultUpdateSchema = z.object({ enabled: z.boolean() }).strict();

export type Environment = z.infer<typeof EnvironmentSchema>;
export type ConnectivityFaultState = z.infer<typeof ConnectivityFaultStateSchema>;

export function getEnvironment(): Promise<Environment> {
  return requestJson('/v1/environment', EnvironmentSchema);
}

export function getConnectivityFault(): Promise<ConnectivityFaultState> {
  return requestJson('/v1/connectivity-fault', ConnectivityFaultStateSchema);
}

export function patchConnectivityFault(enabled: boolean): Promise<ConnectivityFaultState> {
  return sendJson(
    '/v1/connectivity-fault',
    'PATCH',
    ConnectivityFaultUpdateSchema.parse({ enabled }),
    ConnectivityFaultStateSchema,
  );
}
