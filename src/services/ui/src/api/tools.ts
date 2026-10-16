import { z } from 'zod';
import { requestJson } from './transport';

export const ImpersonationModeSchema = z.enum(['app', 'endUserOBO', 'agentUser']);
export const ToolAuthTypeSchema = z.enum(['none', 'entra']);
export const ToolExecutionIdentitySchema = z.enum(['caller', 'server']);

export const ToolCatalogEntrySchema = z.object({
  name: z.string(),
  displayName: z.string(),
  description: z.string(),
  kind: z.enum(['mcp', 'builtin']),
  builtin: z.literal('graph-me').optional(),
  authType: ToolAuthTypeSchema,
  audience: z.string().optional(),
  identityModes: z.array(ImpersonationModeSchema),
  executionIdentity: ToolExecutionIdentitySchema,
}).or(z.object({
  name: z.literal('skills'),
  kind: z.literal('skills'),
  displayName: z.string(),
  description: z.string(),
}));

export const ToolCatalogListSchema = z.object({
  object: z.literal('list'),
  data: z.array(ToolCatalogEntrySchema),
});

const ToolIdentitySchema = z.object({
  authType: ToolAuthTypeSchema,
  audience: z.string().optional(),
  identityModes: z.array(ImpersonationModeSchema),
  executionIdentity: ToolExecutionIdentitySchema,
});

export const AgentToolRefSchema = z.discriminatedUnion('type', [ToolIdentitySchema.extend({
  type: z.literal('mcp'),
  connectionRef: z.string(),
  serverLabel: z.string(),
  serverUrl: z.string(),
  requireApproval: z.enum(['never', 'always']),
  allowedTools: z.array(z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
}), ToolIdentitySchema.extend({
  type: z.literal('builtin'),
  name: z.literal('graph-me'),
  connectionRef: z.string(),
  serverLabel: z.string(),
  requireApproval: z.literal('never'),
})]);

export type ToolCatalogEntry = z.infer<typeof ToolCatalogEntrySchema>;
export type AgentToolRef = z.infer<typeof AgentToolRefSchema>;
export type ImpersonationMode = z.infer<typeof ImpersonationModeSchema>;

export async function listTools(): Promise<ToolCatalogEntry[]> {
  return (await requestJson('/v1/tools', ToolCatalogListSchema)).data;
}
