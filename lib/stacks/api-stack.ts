import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { DatabaseTables } from './database-stack';

export interface ApiStackProps extends cdk.StackProps {
  environment: string;
  envConfig: Record<string, unknown>;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  tables: DatabaseTables;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { environment, userPool } = props;

    // API Gateway
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `kameleon-api-${environment}`,
      description: 'Kameleon PRD Assistant API',
      deployOptions: {
        stageName: environment,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: environment === 'dev',
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: `kameleon-authorizer-${environment}`,
    });

    // Health check endpoint (no auth)
    const healthResource = this.api.root.addResource('health');
    healthResource.addMethod('GET', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseTemplates: {
          'application/json': JSON.stringify({ status: 'healthy', environment }),
        },
      }],
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
    }), {
      methodResponses: [{ statusCode: '200' }],
    });

    // TODO: Add Lambda handlers for axioms, templates, personas, documents, reviews

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: `${environment}-kameleon-api-url`,
    });
  }
}
