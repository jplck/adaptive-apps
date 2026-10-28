# Radius agent demo: deployment, identity and guardrails

**One mutable agent, one retained identity, separately retained state.**
Radius recipes create native resources, not an agent lifecycle operator.

## Building blocks

All types extend the existing `Radius.Resources` catalogue.

| Resource | Declaration | Result |
| --- | --- | --- |
| `agents` | [`agents.bicep`](../../radius/agents.bicep) | Current definition, singleton StatefulSet, stable Responses route and NetworkPolicy |
| `agentIdentities` | [`agent-identity.bicep`](../../radius/agent-identity.bicep) | Separately retained Keycloak identity, Secret and ServiceAccount; optional Entra binding |
| `agentGuardrails` | [`agent-policy.bicep`](../../radius/agent-policy.bicep) | Immutable policy ConfigMap explicitly attached through agent governance |
| `aiModels` / `aiGateways` | [`agent-services.bicep`](../../radius/agent-services.bicep) | Backend connection facts / authenticated model routing, priorities and weights |

## Deployment

Prerequisites: a fresh native Radius environment, registered recipes,
digest-pinned images, Keycloak, and an authenticated model gateway.
This is not an operator migration or an ownership-handover procedure.

1. Publish canonical guardrail policy content and its SHA-256 digest.
2. Deploy `agents.bicep` with `agentName`, `definition`, and explicit governance
   inputs. It composes separately owned identity and mutable agent resources.
   The integrated trading application uses the same composition in `app.bicep`.
3. Wait for the singleton StatefulSet's current revision, retained state PVC,
   and current-generation ingress/policy readiness.
4. Invoke `/agents/{name}/responses` with an authorized bearer and `store: false`.
   Check a benign prompt and synthetic PII through native ingress.
5. Redeploy the definition or pinned image to update the same runtime.
   There is no release selector, promotion step, or previous-release fallback.

```text
agent -> retained identity binding
  -> mutable runtime -> authenticated model gateway -> model backend
       -> retained state PVC
       -> explicit governance sidecar / policy
```

Governance inputs are canonical proxy configuration and its digest, exact
policy reference/content, and `enforce` or `audit` mode. Publishing policy alone
does not attach it or prove runtime enforcement. Input detection does not
provide output redaction or universal Foundry content-safety parity.

## UI demonstration

Open **Agents** and select an agent. **Chat** shows native Responses and
explicit guardrail denials; **Guardrails** shows configured policies and
enforcement status; **Monitor** shows correlated traces and guardrail records.
Embedded trading mode exposes Chat and Monitor, not independent administration
or outage controls. A conversation caches discovery, not an immutable runtime.

Standalone outage control changes only `demo-cloud-egress`; it must not restart
workloads or rotate credentials. Kubernetes policies are additive: another
allow policy can defeat the simulated outage. Established connections and
cached tokens are not evidence of fresh cloud reachability.

## Identity, Foundry and qualification boundaries

Local identity always uses Keycloak. Explicit connected provisioning adds Entra;
cloud-only identity fails when Entra is unavailable. The same hosted OCI digest
remains the portability objective, but the current local artifacts use a
Keycloak token provider: native Foundry Entra authentication is not yet a
qualified 1:1 execution path.

Strict body-aware Responses admission remains opt-in (`strictResponses`).
Enable it explicitly for the bounded stateless contract; the SDK's persisted
caller/state isolation has six known expected-failing contract tests.

`recipes/foundry-agent/main.tf` retains native prompt and hosted Foundry
provisioning with mutable updates and native identity outputs. Source tests are
not live Foundry hosting, cloud A365 ingestion, CNI, GPU, or ownership-handover
qualification. Identity and state remain independently retained; no automatic
pruning, credential regeneration, or fallback is introduced.

Full setup: [Native agents with Radius](native-radius.md).
