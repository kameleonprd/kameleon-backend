import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthStackProps extends cdk.StackProps {
  environment: string;
  envConfig: Record<string, unknown>;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { environment, envConfig } = props;
    const removalPolicy = envConfig.removalPolicy === 'DESTROY'
      ? cdk.RemovalPolicy.DESTROY
      : cdk.RemovalPolicy.RETAIN;

    // Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `kameleon-user-pool-${environment}`,

      // Sign-in options
      signInAliases: {
        email: true,
        username: false,
      },

      // Self-registration
      selfSignUpEnabled: true,

      // Verification
      autoVerify: { email: true },

      // Password policy
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: false,
      },

      // MFA
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        otp: true,
        sms: false,
      },

      // Account recovery
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,

      // Standard attributes
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: true, mutable: true },
      },

      // Custom attributes
      customAttributes: {
        subscriptionTier: new cognito.StringAttribute({ mutable: true }),
        locale: new cognito.StringAttribute({ mutable: true }),
      },

      // Removal policy
      removalPolicy,
    });

    // User Pool Client
    this.userPoolClient = this.userPool.addClient('UserPoolClient', {
      userPoolClientName: `kameleon-client-${environment}`,

      // Auth flows
      authFlows: {
        userPassword: true,
        userSrp: true,
      },

      // Token validity
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),

      // Prevent user existence errors
      preventUserExistenceErrors: true,

      // Generate secret (for server-side apps)
      generateSecret: false,
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${environment}-kameleon-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${environment}-kameleon-user-pool-client-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.userPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `${environment}-kameleon-user-pool-arn`,
    });
  }
}
