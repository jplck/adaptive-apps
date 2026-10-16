extension radius
extension radiusResources

param environment string
param agentName string
param version string
@description('Native prompt or hosted definition with immutable image digest.')
param definition object
param governance object = {}
param resources object = {}
@allowed(['default', 'connected'])
param releaseRecipe string = 'default'

resource app 'Applications.Core/applications@2023-10-01-preview' = {
  name: '${agentName}-${version}'
  properties: { environment: environment }
}
resource agent 'Radius.Resources/agents@2025-08-01-preview' existing = { name: agentName }
resource identity 'Radius.Resources/agentIdentities@2025-08-01-preview' existing = { name: agentName }
resource release 'Radius.Resources/agentReleases@2025-08-01-preview' = {
  name: '${agentName}-${version}'
  // Radius reserves recipe at runtime but omits it from generated Bicep types.
  properties: any(union({
    application: app.id
    environment: environment
    agentName: agentName
    agentUid: agent.properties.agentUid
    version: version
    definition: definition
    resources: resources
    binding: {
      identity: identity.properties.identity
      identityRef: identity.properties.identityRef
      secretRef: identity.properties.secretRef
      serviceAccountName: identity.properties.serviceAccountName
    }
  }, empty(governance) ? {} : { governance: governance },
    releaseRecipe == 'default' ? {} : { recipe: { name: releaseRecipe } }))
}
output captureName string = release.properties.captureName
