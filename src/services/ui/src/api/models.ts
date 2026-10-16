import { z } from 'zod';
import { requestJson } from './transport';

export const ModelProviderSchema = z.string();

export const ModelSetMemberSchema = z.object({
  model: z.string(),
  priority: z.number().int(),
});

export const ModelSchema = z.object({
  id: z.string(),
  object: z.literal('model'),
  created: z.number().int().nullish(),
  owned_by: z.string().nullish(),
  provider: ModelProviderSchema.nullish(),
  kind: z.enum(['single', 'set']).nullish(),
  status: z.enum(['Provisioning', 'Ready', 'Unknown']).nullish(),
  members: z.array(ModelSetMemberSchema).nullish(),
});

export const ModelListSchema = z.object({
  object: z.literal('list'),
  data: z.array(ModelSchema),
});

export type Model = z.infer<typeof ModelSchema>;
export type ModelProvider = z.infer<typeof ModelProviderSchema>;
export type ModelSetMember = z.infer<typeof ModelSetMemberSchema>;

export function modelBaseUrl(): string {
  return (import.meta.env.VITE_GATEWAY_URL?.trim() || '/models/v1').replace(/\/+$/, '');
}

export async function listModels(): Promise<Model[]> {
  return (await requestJson(`${modelBaseUrl()}/models`, ModelListSchema)).data;
}
