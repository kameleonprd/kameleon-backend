#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GitHubOidcStack } from '../lib/stacks/github-oidc-stack';

/**
 * Bootstrap stack for setting up GitHub OIDC authentication.
 * Run this once before setting up CI/CD:
 *
 * npx cdk deploy --app "npx ts-node bin/bootstrap.ts" --profile kama
 */

const app = new cdk.App();

new GitHubOidcStack(app, 'kameleon-github-oidc', {
  stackName: 'kameleon-github-oidc',
  description: 'GitHub OIDC provider and IAM roles for Kameleon CI/CD',
  env: {
    account: '474957690594',
    region: 'us-east-1',
  },
  githubOrg: 'kameleonprd',
  githubRepo: 'kameleon-backend',
});

cdk.Tags.of(app).add('Project', 'Kameleon');
cdk.Tags.of(app).add('Purpose', 'CI/CD Bootstrap');
