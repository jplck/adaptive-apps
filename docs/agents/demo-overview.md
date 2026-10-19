# Radius agent demo: deployment, identity and guardrails

**One agent, one retained identity, one policy, one explicit release.**
Radius recipes create native Kubernetes resources; no agent lifecycle operator.

## The four building blocks

All types below belong to the existing `Radius.Resources` catalogue.
Paths are relative to `radius/`.

| Resource | Declaration | Recipe / result |
| --- | --- | --- |
| `agents` | [`agents.bicep`](../../radius/agents.bicep) | `recipes/agents/logical.bicep`: logical name, identity reference and active version |
| `agentIdentities` | [`agent-identity.bicep`](../../radius/agent-identity.bicep) | `recipes/identity-local` or `identity-connected`: retained identity, Secret and ServiceAccount |
| `agentGuardrails` | [`agent-policy.bicep`](../../radius/agent-policy.bicep) | `recipes/agent-guardrails/native-policy.bicep`: immutable policy ConfigMap |
| `agentReleases` | [`agent-release.bicep`](../../radius/agent-release.bicep) | `recipes/agents/release.bicep`: immutable capture, StatefulSet, ingress and NetworkPolicy |

## Deployment in six steps

Prerequisite: an existing native Radius environment with registered recipes,
reachable digest-pinned images, Keycloak, model gateway and a configured model.
This is an application demo, not a platform bootstrap or operator migration.

1. **Declare the agent** with `activeVersion=''`.
2. **Provision its identity** separately; set the logical agent's `identityRef`
   to the returned binding.
3. **Publish a policy** with canonical content and its SHA-256 digest.
4. **Deploy a new release**, for example `v1`, with an immutable image digest,
   model, instructions and the exact identity and governance snapshots.
5. **Qualify that exact release**: check readiness and authenticated invocation;
   try both an allowed prompt and synthetic PII.
6. **Promote explicitly** by setting the logical agent's `activeVersion` to `v1`,
   preserving its identity reference.

```text
agent ── identityRef ──> retained identity
  └── activeVersion ──> immutable release
                         ├── captured identity binding
                         ├── captured policy + proxy configuration
                         └── agent runtime ──> authenticated model gateway
```

## One example, built up recipe by recipe

**Illustrative Bicep excerpts only, not deployable files.** Each step extends
the same `demo-writer` story. Extensions, application/environment fields and
input declarations are omitted; identity, policy and release keep separate
ownership in a real deployment. The environment selects the recipes.

### 1. Start with an agent

The logical recipe gives the agent a name, not a running workload.

```bicep
resource agent 'Radius.Resources/agents@2025-08-01-preview' = {
  name: 'demo-writer'
  properties: {
    kind: 'prompt'
    identityRef: ''
    activeVersion: ''
  }
}
```

### 2. Add its identity

The default local identity recipe creates a retained Keycloak identity.
After provisioning, update the agent's `identityRef` to the returned binding.

```bicep
resource identity 'Radius.Resources/agentIdentities@2025-08-01-preview' = {
  name: 'demo-writer'
  properties: {
    agentName: agent.name
    agentResourceId: agent.id
    agentUid: agent.properties.agentUid
    delegation: { enabled: false }
  }
}
```

### 3. Add a guardrail

The policy recipe publishes immutable rules: **deny detected PII, otherwise
allow `local-chat`**. The inputs below stand for canonical policy JSON and its
SHA-256; publishing alone does not enforce it.

```bicep
resource policy 'Radius.Resources/agentGuardrails@2025-08-01-preview' = {
  name: 'demo-input-pii-v1'
  properties: {
    policyNamespace: 'adaptive-guardrails-apps'
    policies: canonicalPolicy
    policyDigest: policySha256
  }
}
```

### 4. Deploy the agent with that identity and guardrail

The release recipe captures the identity and policy and creates the workload.
Proxy inputs represent the prepared canonical configuration for this policy
and model ingress, not hand-written placeholder hashes.

```bicep
resource release 'Radius.Resources/agentReleases@2025-08-01-preview' = {
  name: 'demo-writer-v1'
  properties: {
    agentName: agent.name
    agentUid: agent.properties.agentUid
    version: 'v1'
    definition: {
      kind: 'prompt'
      runtimeImage: runtimeImageDigest
      model: 'local-chat'
      instructions: 'Help draft clear, concise text.'
      tools: []
    }
    binding: {
      identity: identity.properties.identity
      identityRef: identity.properties.identityRef
      secretRef: identity.properties.secretRef
      serviceAccountName: identity.properties.serviceAccountName
    }
    governance: {
      reference: policy.properties.bundleRef
      content: canonicalPolicy
      config: canonicalProxyConfig
      digest: proxyConfigSha256
      mode: 'enforce'
    }
  }
}
```

After qualifying `v1`, update the **logical agent** to
`identityRef: identity.properties.identityRef` and `activeVersion: 'v1'`.
For a change, publish `v2`; keep the identity and do not overwrite `v1`.

## Show it in the UI

Open **Agents**, select the exact release, then:

| Tab | Demo |
| --- | --- |
| Chat | Send a benign request, then synthetic PII; confirm an explicit guardrail denial in enforce mode |
| Guardrails | Show the policy attached to this release, its rules and enforcement state |
| Monitor | Inspect the corresponding request records |

## Boundaries worth mentioning

- **Identity:** local uses Keycloak; connected provisioning can add Entra.
  Cloud-only identity requires Entra and fails explicitly when unavailable.
- **Guardrails:** publishing a policy does not attach it globally. Capture its
  exact content/reference and canonical proxy configuration in the release.
  PII protection covers model-bound input, not output redaction.
- **Ownership:** identity and state are retained separately. Changes require a
  new release; no automatic pruning, credential regeneration or release fallback.
- **Traffic:** invocation uses native Responses ingress; model calls use the
  authenticated gateway, never the diagnostics API.

Full setup and qualification: [Native agents with Radius](native-radius.md).
