extension radius
extension radiusResources

param environment string
param agentName string
param delegation object = { enabled: false }
@allowed(['default', 'connected'])
param identityRecipe string = 'default'

resource app 'Applications.Core/applications@2023-10-01-preview' = {
  name: '${agentName}-identity'
  properties: { environment: environment }
}
resource agent 'Radius.Resources/agents@2025-08-01-preview' existing = { name: agentName }
resource identity 'Radius.Resources/agentIdentities@2025-08-01-preview' = {
  name: agentName
  // Radius reserves recipe at runtime but omits it from generated Bicep types.
  properties: any(union({
    application: app.id
    environment: environment
    agentName: agentName
    agentResourceId: agent.id
    agentUid: agent.properties.agentUid
    delegation: delegation
  }, identityRecipe == 'default' ? {} : { recipe: { name: identityRecipe } }))
}
output identityRef string = identity.properties.identityRef
