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
  version: z.string().nullish(),
  requestedActiveVersion: z.string().nullable(),
  activeVersion: z.string().nullable(),
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

export const AgentVersionSchema = z.object({
  name: z.string(),
  version: z.string(),
  created_at: z.number().int().nullish(),
  status: z.enum(['Available', 'Pending', 'Progressing', 'Failed', 'Retired']),
  endpoint: z.string().nullable(),
  definitionDigest: z.string().nullable(),
  requestedActive: z.boolean(),
  active: z.boolean(),
});

export const AgentListEntrySchema = AgentSchema.extend({ releases: z.array(AgentVersionSchema) });

export type Agent = z.infer<typeof AgentSchema>;
export type AgentIdentity = z.infer<typeof AgentIdentitySchema>;
export type AgentVersion = z.infer<typeof AgentVersionSchema>;
export type AgentListEntry = z.infer<typeof AgentListEntrySchema>;

export async function listAgents(): Promise<AgentListEntry[]> {
  return (await requestJson('/v1/agents', z.object({
    object: z.literal('list'),
    data: z.array(AgentListEntrySchema),
  }))).data;
}

export async function getAgent(name: string, version?: string): Promise<Agent> {
  const base = `/v1/agents/${encodeURIComponent(name)}`;
  if (version) {
    return requestJson(`${base}/versions/${encodeURIComponent(version)}`, AgentSchema);
  }
  return requestJson(base, AgentSchema);
}

export async function listAgentVersions(name: string): Promise<AgentVersion[]> {
  return (await requestJson(`/v1/agents/${encodeURIComponent(name)}/versions`, z.object({
    object: z.literal('list'),
    data: z.array(AgentVersionSchema),
  }))).data;
}
