#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AuthStack } from '../lib/stacks/auth-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { ApiStack } from '../lib/stacks/api-stack';

const app = new cdk.App();

// Get environment from context
const environment = app.node.tryGetContext('environment') || 'dev';
const envConfig = app.node.tryGetContext('environments')[environment];

if (!envConfig) {
  throw new Error(`Environment configuration not found for: ${environment}`);
}

const stackPrefix = `kameleon-${environment}`;

// Environment configuration
const env: cdk.Environment = {
  account: process.env.AWS_ACCOUNT_ID || process.env.CDK_DEFAULT_ACCOUNT,
  region: envConfig.region || 'us-east-1',
};

// Shared props
const sharedProps = {
  env,
  environment,
  envConfig,
};

// Auth Stack - Cognito User Pool
const authStack = new AuthStack(app, `${stackPrefix}-auth`, {
  ...sharedProps,
  stackName: `${stackPrefix}-auth`,
  description: 'Kameleon Auth Stack - Cognito User Pool',
});

// Database Stack - DynamoDB Tables
const databaseStack = new DatabaseStack(app, `${stackPrefix}-database`, {
  ...sharedProps,
  stackName: `${stackPrefix}-database`,
  description: 'Kameleon Database Stack - DynamoDB Tables',
});

// API Stack - API Gateway + Lambda Handlers
const apiStack = new ApiStack(app, `${stackPrefix}-api`, {
  ...sharedProps,
  stackName: `${stackPrefix}-api`,
  description: 'Kameleon API Stack - API Gateway and Lambda Handlers',
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  tables: databaseStack.tables,
});

// Add dependencies
databaseStack.addDependency(authStack);
apiStack.addDependency(databaseStack);

// Tags
cdk.Tags.of(app).add('Project', 'Kameleon');
cdk.Tags.of(app).add('Environment', environment);
