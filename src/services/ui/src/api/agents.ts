import { z } from 'zod';
import { AgentToolRefSchema } from './tools';
import { requestJson } from './transport';

export const AgentIdentitySchema = z.object({
  entraClientId: z.string().nullish(),
  blueprintId: z.string().nullish(),
  keycloakClientId: z.string().nullish(),
  entraTenantId: z.string().nullish(),
  oboClientId: z.string().nullish(),
  graphDelegation: z.boolean().optional(),
  agentUserId: z.string().nullish(),
});

export const AgentSchema = z.object({
  name: z.string(),
  type: z.enum(['prompt', 'hosted']),
  description: z.string().nullish(),
  endpoint: z.string().nullable(),
  created: z.number().int().nullish(),
  updated: z.number().int().nullish(),
  identity: AgentIdentitySchema.nullish(),
  phase: z.enum(['Pending', 'Ready', 'Failed']).nullish(),
  instructions: z.string().nullish(),
  model: z.string().nullish(),
  temperature: z.number().nullish(),
  topP: z.number().nullish(),
  tools: z.array(AgentToolRefSchema).nullish(),
  skills: z.array(z.object({
    path: z.string(),
    name: z.string(),
    description: z.string(),
  })).nullish(),
  image: z.string().nullish(),
  port: z.number().int().nullish(),
  definition: z.string().nullish(),
});

export type Agent = z.infer<typeof AgentSchema>;
export type AgentIdentity = z.infer<typeof AgentIdentitySchema>;

export async function listAgents(): Promise<Agent[]> {
  return (await requestJson('/v1/agents', z.object({
    object: z.literal('list'),
    data: z.array(AgentSchema),
  }))).data;
}

export async function getAgent(name: string): Promise<Agent> {
  return requestJson(`/v1/agents/${encodeURIComponent(name)}`, AgentSchema);
}
