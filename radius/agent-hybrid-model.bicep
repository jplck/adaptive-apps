extension radius
extension radiusResources

param environment string
param applicationName string = 'agent-services'
param localName string = 'local-chat'
param cloudName string = 'foundry-chat'
param hybridName string = 'hybrid-chat'
@description('Smaller priorities are preferred. Cloud-first demonstrates local fallback during an outage.')
param cloudPriority int = 0
param localPriority int = 1

resource app 'Applications.Core/applications@2023-10-01-preview' existing = {
  name: applicationName
}
resource local 'Radius.Resources/aiModels@2025-08-01-preview' existing = {
  name: localName
}
resource cloud 'Radius.Resources/aiModels@2025-08-01-preview' existing = {
  name: cloudName
}
resource hybrid 'Radius.Resources/aiGateways@2025-08-01-preview' = {
  name: hybridName
  properties: {
    application: app.id
    environment: environment
    model: hybridName
    members: [
      {
        deployment: cloud.properties.deployment
        endpoint: cloud.properties.endpoint
        provider: cloud.properties.provider
        apiVersion: cloud.properties.apiVersion
        priority: cloudPriority
        weight: 1
      }
      {
        deployment: local.properties.deployment
        endpoint: local.properties.endpoint
        provider: local.properties.provider
        apiVersion: local.properties.apiVersion
        priority: localPriority
        weight: 1
      }
    ]
  }
}
