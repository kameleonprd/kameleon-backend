import { QueryCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../clients/dynamodb-client';
import { IAxiomRepository } from '../../application/ports/repositories/axiom-repository';
import { Axiom, CreateAxiomInput, UpdateAxiomInput } from '../../domain/entities/axiom';
import { ulid } from 'ulid';

export class DynamoAxiomRepository implements IAxiomRepository {
  private readonly tableName = process.env.AXIOMS_TABLE_NAME!;

  async findByUserId(userId: string): Promise<Axiom[]> {
    const result = await docClient.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: { ':userId': userId },
    }));

    return (result.Items || []) as Axiom[];
  }

  async findById(userId: string, axiomId: string): Promise<Axiom | null> {
    const result = await docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { userId, axiomId },
    }));

    return result.Item ? (result.Item as Axiom) : null;
  }

  async findDefaults(): Promise<Axiom[]> {
    const result = await docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'default-axioms-index',
      KeyConditionExpression: 'isDefault = :isDefault',
      ExpressionAttributeValues: { ':isDefault': 'true' },
    }));

    return (result.Items || []) as Axiom[];
  }

  async create(userId: string, input: CreateAxiomInput): Promise<Axiom> {
    const now = new Date().toISOString();
    const axiom: Axiom = {
      userId,
      axiomId: ulid(),
      name: input.name,
      description: input.description,
      isDefault: false,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: axiom,
    }));

    return axiom;
  }

  async update(userId: string, axiomId: string, input: UpdateAxiomInput): Promise<Axiom> {
    const updateExpressions: string[] = ['updatedAt = :updatedAt'];
    const expressionAttributeValues: Record<string, unknown> = {
      ':updatedAt': new Date().toISOString(),
    };
    const expressionAttributeNames: Record<string, string> = {};

    if (input.name !== undefined) {
      updateExpressions.push('#name = :name');
      expressionAttributeValues[':name'] = input.name;
      expressionAttributeNames['#name'] = 'name';
    }

    if (input.description !== undefined) {
      updateExpressions.push('description = :description');
      expressionAttributeValues[':description'] = input.description;
    }

    if (input.isActive !== undefined) {
      updateExpressions.push('isActive = :isActive');
      expressionAttributeValues[':isActive'] = input.isActive;
    }

    if (input.sortOrder !== undefined) {
      updateExpressions.push('sortOrder = :sortOrder');
      expressionAttributeValues[':sortOrder'] = input.sortOrder;
    }

    const result = await docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { userId, axiomId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ...(Object.keys(expressionAttributeNames).length > 0
        ? { ExpressionAttributeNames: expressionAttributeNames }
        : {}),
      ReturnValues: 'ALL_NEW',
    }));

    return result.Attributes as Axiom;
  }

  async delete(userId: string, axiomId: string): Promise<void> {
    await docClient.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { userId, axiomId },
    }));
  }
}
