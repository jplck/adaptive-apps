import { z } from 'zod';
import { requestJson } from './transport';

const PolicyRuleSchema = z.object({
  name: z.string(),
  stage: z.enum(['pre_input', 'pre_tool']),
  condition: z.string(),
  action: z.enum(['allow', 'deny', 'require_approval']),
  description: z.string(),
});

export const PolicyBundleSchema = z.object({
  policies: z.array(z.object({
    name: z.string(),
    apiVersion: z.literal('governance.toolkit/v1'),
    default_action: z.literal('deny'),
    mode: z.enum(['enforce', 'audit']).optional(),
    rules: z.array(PolicyRuleSchema),
  })),
});
export type PolicyBundle = z.infer<typeof PolicyBundleSchema>;

const PolicyResourceSchema = z.object({
  reference: z.string(),
  namespace: z.string(),
  targets: z.array(z.string()),
  bundle: PolicyBundleSchema,
});
export type PolicyResource = z.infer<typeof PolicyResourceSchema>;

const PlatformGuardrailsSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['enforce', 'audit']).nullable(),
  policies: z.array(PolicyResourceSchema),
  enforcementVerified: z.boolean().optional(),
});

const AgentGuardrailsSchema = z.object({
  name: z.string(),
  version: z.string().nullable(),
  enabled: z.boolean(),
  mode: z.enum(['enforce', 'audit']).nullable(),
  inherited: z.array(PolicyResourceSchema),
  attached: PolicyResourceSchema.nullable(),
  policy_sha256: z.string().nullable(),
  deployment: z.string().nullable(),
  phase: z.string().nullable(),
  enforcementVerified: z.boolean().optional(),
});

export type PlatformGuardrails = z.infer<typeof PlatformGuardrailsSchema>;
export type AgentGuardrails = z.infer<typeof AgentGuardrailsSchema>;

export function getPlatformGuardrails(): Promise<PlatformGuardrails> {
  return requestJson('/v1/guardrails', PlatformGuardrailsSchema);
}

export function getAgentGuardrails(name: string, version?: string): Promise<AgentGuardrails> {
  const query = version ? `?version=${encodeURIComponent(version)}` : '';
  return requestJson(`/v1/agents/${encodeURIComponent(name)}/guardrails${query}`, AgentGuardrailsSchema);
}
