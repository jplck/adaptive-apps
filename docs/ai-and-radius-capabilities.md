# Adaptive AI Stack

> subject to change - in development

## AI capabilities

- **Local model inference:** `*-ai` portfolios support in-cluster KAITO/vLLM models for local and offline inference. GPU and model-download prerequisites apply.
- **Cloud model inference:** Azure OpenAI / Foundry models can be reached through the authenticated LiteLLM gateway using gateway workload identity; the gateway does not require an Azure API key.
- **Hybrid model routing:** Model groups support explicit priority and weight settings for configured local-first or cloud-first routing and fallback. Streaming is supported.
- **Radius-hosted agents:** Native Radius resources deploy mutable prompt and hosted agents with stable endpoints and separately retained identity/state. The existing trading sample integrates them as an opt-in.
- **Local agent identity:** Radius provisions a Keycloak client identity for each native agent. Local identity and application login continue to use Keycloak, including when the cluster has internet connectivity.
- **Optional Entra agent identity:** When declared in Radius, an agent additionally receives an Entra Agent ID and blueprint/principal for cloud access such as Graph. This complements, rather than replaces, its local Keycloak identity.
- **Cloud outage resilience:** Configured model groups support priority-based fallback between cloud and local inference. Local agent identity remains available through Keycloak; Entra-only operations still require cloud access.
- **Agent guardrails:** An optional in-pod Agent Governance Toolkit sidecar provides selected input-safety and governed tool-call capabilities with `enforce` and `audit` modes. This is not full Foundry content-safety parity. Mesh-level OPA/Istio policy is complementary.
- **AI observability and outage demo:** Native agent calls emit OpenTelemetry traces visible through Monitor. A demo control simulates cloud-egress loss without changing workloads or credentials.

## 1:1 hosted-image compatibility: local/edge and Foundry

- **Same application artifact:** Hosted agents are designed to use the same container image locally, at the edge, and in Foundry, without rebuilding for each environment.
- **Authentication qualification:** Local artifacts currently use a Keycloak token provider. Native Foundry Entra authentication and live same-image execution remain a portability gap; identical digests alone do not prove 1:1 behavior.
- **Artifact integrity:** Foundry deployment requires the original image digest to be preserved when the image is copied to Azure Container Registry.
- **Prompt-agent portability:** Prompt agents map to native prompt definitions in Foundry. Their portability concerns instructions, model selection, and supported capabilities rather than an identical container image.

## Radius support

- **Capabilities, not product lock-in:** Radius separates what an application needs from how an environment provides it. Custom resource types and environment-specific recipes let commercial products, cloud services, and open-source projects implement capability contracts. Supporting another implementation requires a suitable recipe and compatible behavior; it is not automatic compatibility with every product.
- **Identity as an example:** Recipes connect an application's identity requirements to the services available in an environment. Keycloak illustrates an open-source implementation, while Entra provides cloud identity capabilities. The same approach applies to other capabilities, with each implementation requiring a compatible contract and recipe.
- One unified `Radius.Resources` catalogue extends existing types for AI models, gateways, agents, identities, login clients, guardrails, governance, databases, and MQTT brokers.
- Environment-specific Recipes map those contracts to implementations such as KAITO/vLLM, Azure OpenAI, Foundry, Kubernetes, and Azure services.
- The six portfolios are `min`, `core`, `ent`, and their `*-ai` counterparts. GPU model provisioning requires explicit KAITO opt-in; native agents are additive, not a seventh portfolio.
- Native agent hosting uses Radius declarations and native Kubernetes/Foundry resources—not a second `Radius.Resources` namespace, an agent lifecycle operator, or a compatibility API.

## Key Radius recipes

Selected recipes for native agents, models, identity, and guardrails; names are relative to `radius/recipes/`.

| Recipe | Purpose |
| --- | --- |
| `ai-agent/native-model.bicep` | Individual inference backend connection facts. |
| `ai-agent/native-gateway.bicep` | AI gateway routing, priorities, weights and fallback. |
| `agents/logical.bicep` | Mutable agent metadata and runtime composition. |
| `agents/runtime.bicep` | Singleton prompt or hosted workload, retained state and stable ingress. |
| `foundry-agent/main.tf` | Native mutable Foundry prompt or hosted deployment; not live-qualified. |
| `identity-local/main.tf` | Retained Keycloak agent identity and Kubernetes bindings. |
| `identity-connected/main.tf` | Keycloak identity paired with the declared Entra Agent ID and blueprint. |
| `agent-guardrails/native-policy.bicep` | Immutable guardrail policy explicitly attached to native agents. |
