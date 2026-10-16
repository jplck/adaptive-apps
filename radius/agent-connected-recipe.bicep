extension radius

param environmentName string = 'agents'
@description('Current environment properties, captured before this additive recipe registration.')
param environmentProperties object
param tenantId string
param provisionerClientId string
param sponsorUserId string
param ownerUserId string
param oidcIssuer string
param credentialsStoreId string
@description('Immutable archive containing the connected identity recipe.')
param recipeArchive string
@description('Keep existing local peer authorization claims when enriching a retained identity.')
param preserveLocalActor bool = false

var recipes = environmentProperties.recipes
var identityRecipe = recipes['Radius.Resources/agentIdentities'].default
var executor = environmentProperties.recipeConfig

resource environment 'Applications.Core/environments@2023-10-01-preview' = {
  name: environmentName
  properties: union(environmentProperties, {
    recipes: union(recipes, {
      'Radius.Resources/agentIdentities': union(recipes['Radius.Resources/agentIdentities'], {
        connected: union(identityRecipe, {
          templatePath: '${recipeArchive}//identity-connected'
          parameters: union(identityRecipe.parameters, {
            tenant_id: tenantId
            sponsor_user_id: sponsorUserId
            owner_user_id: ownerUserId
            oidc_issuer: oidcIssuer
            preserve_local_actor: preserveLocalActor
          })
        })
      })
    })
    recipeConfig: {
      env: union(executor.env, {
        ARM_TENANT_ID: tenantId
        ARM_CLIENT_ID: provisionerClientId
        ARM_USE_CLI: 'false'
      })
      envSecrets: union(executor.envSecrets, {
        ARM_CLIENT_CERTIFICATE: { source: credentialsStoreId, key: 'graph-client-certificate' }
        ARM_CLIENT_CERTIFICATE_PASSWORD: { source: credentialsStoreId, key: 'graph-client-certificate-password' }
      })
    }
  })
}
