import { z } from 'zod';
import { requestJson, sendJson } from './transport';

export const AgentCardCapabilitiesSchema = z.object({
  streaming: z.boolean().nullish(),
  pushNotifications: z.boolean().nullish(),
  extendedAgentCard: z.boolean().nullish(),
});

export const AgentCardSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  examples: z.array(z.string()).nullish(),
  inputModes: z.array(z.string()).nullish(),
  outputModes: z.array(z.string()).nullish(),
});

const AgentCardSchema = z.object({
  name: z.string().nullish(),
  description: z.string().nullish(),
  version: z.string().nullish(),
  capabilities: AgentCardCapabilitiesSchema.nullish(),
  defaultInputModes: z.array(z.string()).nullish(),
  defaultOutputModes: z.array(z.string()).nullish(),
  skills: z.array(AgentCardSkillSchema).nullish(),
});

export const AllowedCallerSchema = z.object({
  kind: z.enum(['foundryAgent', 'adaptiveAgent', 'anyAuthenticated']),
  oid: z.string().nullish(),
  agentId: z.string().nullish(),
  name: z.string().nullish(),
});

export const A2APeerSchema = z.object({
  name: z.string(),
  cardUrl: z.string().nullish(),
  a2aBaseUrl: z.string().nullish(),
  audience: z.string().nullish(),
  protocolVersion: z.string().nullish(),
  protocolBinding: z.enum(['JSONRPC', 'HTTP+JSON']).nullish(),
  auth: z.enum(['agentIdentity', 'keycloakClientCredentials', 'none']).nullish(),
  graphResourceAppId: z.string().nullish(),
  graphAppRoleId: z.string().nullish(),
  ready: z.boolean().nullish(),
  lastCardFetchedAt: z.string().nullish(),
});

export const AgentCardResponseSchema = z.object({
  enabled: z.boolean(),
  declared: AgentCardSchema,
  resolved: z.record(z.string(), z.any()),
  observedCardHash: z.string().nullish(),
  resolvedCardHash: z.string(),
  audience: z.string().nullish(),
  cardUrl: z.string().nullish(),
  a2aBaseUrl: z.string().nullish(),
  connectionString: z.string().nullish(),
  allowedCallers: z.array(AllowedCallerSchema),
  peers: z.array(A2APeerSchema),
  blueprintConsentPending: z.boolean().nullish(),
});

export const AgentCardDifferenceSchema = z.object({
  path: z.string(),
  declared: z.unknown().nullish(),
  live: z.unknown().nullish(),
});

export const AgentCardValidationSchema = z.object({
  valid: z.boolean(),
  live: z.enum(['fetched', 'unavailable']).nullish(),
  differences: z.array(AgentCardDifferenceSchema).nullish(),
  message: z.string().nullish(),
});

export const TestA2ACallSchema = z.object({
  peer: z.string(),
  message: z.string(),
});

export const TestA2ACallResultSchema = z.object({
  ok: z.boolean(),
  peerName: z.string(),
  responseText: z.string().nullish(),
  traceId: z.string().nullish(),
  cardUrl: z.string().nullish(),
  errorMessage: z.string().nullish(),
});

export type AgentCardResponse = z.infer<typeof AgentCardResponseSchema>;
export type AgentCardValidation = z.infer<typeof AgentCardValidationSchema>;
export type AgentCardDifference = z.infer<typeof AgentCardDifferenceSchema>;
export type TestA2ACall = z.infer<typeof TestA2ACallSchema>;
export type TestA2ACallResult = z.infer<typeof TestA2ACallResultSchema>;

export function getAgentCard(name: string): Promise<AgentCardResponse> {
  return requestJson(`/v1/agents/${encodeURIComponent(name)}/agent-card`, AgentCardResponseSchema);
}

export function validateAgentCard(name: string): Promise<AgentCardValidation> {
  return sendJson(
    `/v1/agents/${encodeURIComponent(name)}/agent-card/validate`,
    'POST',
    {},
    AgentCardValidationSchema,
  );
}

export function testA2ACall(name: string, body: TestA2ACall): Promise<TestA2ACallResult> {
  return sendJson(
    `/v1/agents/${encodeURIComponent(name)}/a2a/test-call`,
    'POST',
    TestA2ACallSchema.parse(body),
    TestA2ACallResultSchema,
  );
}
