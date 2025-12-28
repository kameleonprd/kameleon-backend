import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  environment: string;
  envConfig: Record<string, unknown>;
}

export interface DatabaseTables {
  users: dynamodb.Table;
  axioms: dynamodb.Table;
  templates: dynamodb.Table;
  personas: dynamodb.Table;
  calibrationExamples: dynamodb.Table;
  documents: dynamodb.Table;
  documentVersions: dynamodb.Table;
  reviews: dynamodb.Table;
}

export class DatabaseStack extends cdk.Stack {
  public readonly tables: DatabaseTables;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { environment, envConfig } = props;
    const removalPolicy = envConfig.removalPolicy === 'DESTROY'
      ? cdk.RemovalPolicy.DESTROY
      : cdk.RemovalPolicy.RETAIN;

    const tableProps = {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy,
    };

    // Users Table
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      ...tableProps,
      tableName: `kameleon-users-${environment}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
    });

    usersTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Axioms Table
    const axiomsTable = new dynamodb.Table(this, 'AxiomsTable', {
      ...tableProps,
      tableName: `kameleon-axioms-${environment}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'axiomId', type: dynamodb.AttributeType.STRING },
    });

    axiomsTable.addGlobalSecondaryIndex({
      indexName: 'default-axioms-index',
      partitionKey: { name: 'isDefault', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sortOrder', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Templates Table
    const templatesTable = new dynamodb.Table(this, 'TemplatesTable', {
      ...tableProps,
      tableName: `kameleon-templates-${environment}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'templateId', type: dynamodb.AttributeType.STRING },
    });

    templatesTable.addGlobalSecondaryIndex({
      indexName: 'default-templates-index',
      partitionKey: { name: 'isDefault', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'audienceType', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Personas Table
    const personasTable = new dynamodb.Table(this, 'PersonasTable', {
      ...tableProps,
      tableName: `kameleon-personas-${environment}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'personaId', type: dynamodb.AttributeType.STRING },
    });

    // Calibration Examples Table
    const calibrationExamplesTable = new dynamodb.Table(this, 'CalibrationExamplesTable', {
      ...tableProps,
      tableName: `kameleon-calibration-examples-${environment}`,
      partitionKey: { name: 'personaId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'exampleId', type: dynamodb.AttributeType.STRING },
    });

    calibrationExamplesTable.addGlobalSecondaryIndex({
      indexName: 'user-examples-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Documents Table
    const documentsTable = new dynamodb.Table(this, 'DocumentsTable', {
      ...tableProps,
      tableName: `kameleon-documents-${environment}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
    });

    documentsTable.addGlobalSecondaryIndex({
      indexName: 'status-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'updatedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Document Versions Table
    const documentVersionsTable = new dynamodb.Table(this, 'DocumentVersionsTable', {
      ...tableProps,
      tableName: `kameleon-document-versions-${environment}`,
      partitionKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'versionId', type: dynamodb.AttributeType.STRING },
    });

    // Reviews Table
    const reviewsTable = new dynamodb.Table(this, 'ReviewsTable', {
      ...tableProps,
      tableName: `kameleon-reviews-${environment}`,
      partitionKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'reviewId', type: dynamodb.AttributeType.STRING },
    });

    reviewsTable.addGlobalSecondaryIndex({
      indexName: 'reviewer-type-index',
      partitionKey: { name: 'reviewerType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Assign tables
    this.tables = {
      users: usersTable,
      axioms: axiomsTable,
      templates: templatesTable,
      personas: personasTable,
      calibrationExamples: calibrationExamplesTable,
      documents: documentsTable,
      documentVersions: documentVersionsTable,
      reviews: reviewsTable,
    };

    // Outputs
    Object.entries(this.tables).forEach(([name, table]) => {
      new cdk.CfnOutput(this, `${name}TableName`, {
        value: table.tableName,
        description: `${name} DynamoDB Table Name`,
        exportName: `${environment}-kameleon-${name}-table-name`,
      });
    });
  }
}
