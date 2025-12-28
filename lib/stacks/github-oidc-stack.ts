import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface GitHubOidcStackProps extends cdk.StackProps {
  githubOrg: string;
  githubRepo: string;
}

export class GitHubOidcStack extends cdk.Stack {
  public readonly devRole: iam.Role;
  public readonly stageRole: iam.Role;
  public readonly prodRole: iam.Role;

  constructor(scope: Construct, id: string, props: GitHubOidcStackProps) {
    super(scope, id, props);

    const { githubOrg, githubRepo } = props;

    // GitHub OIDC Provider (only create if it doesn't exist)
    const githubProvider = new iam.OpenIdConnectProvider(this, 'GitHubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      thumbprints: ['ffffffffffffffffffffffffffffffffffffffff'], // GitHub's thumbprint
    });

    // Common policy for CDK deployments
    const cdkDeployPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        // CloudFormation
        'cloudformation:*',
        // IAM (for creating roles)
        'iam:*',
        // Lambda
        'lambda:*',
        // API Gateway
        'apigateway:*',
        // DynamoDB
        'dynamodb:*',
        // Cognito
        'cognito-idp:*',
        // S3 (for CDK assets)
        's3:*',
        // SSM (for parameters)
        'ssm:*',
        // CloudWatch
        'logs:*',
        'cloudwatch:*',
        // STS (for assuming roles)
        'sts:AssumeRole',
        // ECR (for Docker images if needed)
        'ecr:*',
        // Bedrock
        'bedrock:*',
      ],
      resources: ['*'],
    });

    // Create role for each environment
    const createDeployRole = (envName: string, branches: string[]): iam.Role => {
      const conditions: Record<string, Record<string, string>> = {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub': branches.map(
            branch => `repo:${githubOrg}/${githubRepo}:ref:refs/heads/${branch}`
          ).join(','),
        },
      };

      // For multiple branches, use ForAnyValue
      if (branches.length > 1) {
        delete conditions.StringLike;
        conditions['ForAnyValue:StringLike'] = {
          'token.actions.githubusercontent.com:sub': branches.map(
            branch => `repo:${githubOrg}/${githubRepo}:ref:refs/heads/${branch}`
          ),
        } as unknown as Record<string, string>;
      }

      const role = new iam.Role(this, `GitHubActions${envName}Role`, {
        roleName: `github-actions-kameleon-${envName.toLowerCase()}`,
        assumedBy: new iam.WebIdentityPrincipal(
          githubProvider.openIdConnectProviderArn,
          {
            StringEquals: {
              'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
            },
            StringLike: {
              'token.actions.githubusercontent.com:sub': `repo:${githubOrg}/${githubRepo}:ref:refs/heads/*`,
            },
          }
        ),
        description: `Role for GitHub Actions to deploy to ${envName} environment`,
        maxSessionDuration: cdk.Duration.hours(1),
      });

      role.addToPolicy(cdkDeployPolicy);

      return role;
    };

    // Dev role - can be assumed from dev branch
    this.devRole = createDeployRole('Dev', ['dev']);

    // Stage role - can be assumed from stage branch
    this.stageRole = createDeployRole('Stage', ['stage']);

    // Prod role - can be assumed from main branch
    this.prodRole = createDeployRole('Prod', ['main']);

    // Outputs
    new cdk.CfnOutput(this, 'GitHubOidcProviderArn', {
      value: githubProvider.openIdConnectProviderArn,
      description: 'GitHub OIDC Provider ARN',
    });

    new cdk.CfnOutput(this, 'DevRoleArn', {
      value: this.devRole.roleArn,
      description: 'IAM Role ARN for dev deployments',
    });

    new cdk.CfnOutput(this, 'StageRoleArn', {
      value: this.stageRole.roleArn,
      description: 'IAM Role ARN for stage deployments',
    });

    new cdk.CfnOutput(this, 'ProdRoleArn', {
      value: this.prodRole.roleArn,
      description: 'IAM Role ARN for prod deployments',
    });
  }
}
