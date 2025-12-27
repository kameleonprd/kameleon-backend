import { withMiddleware, response, getUserId, logger, z } from '../shared/middleware';
import { getAxiomRepository } from '../../shared/di/container';
import type { Context } from 'aws-lambda';
import type { ValidatedAPIGatewayProxyEvent } from '../shared/middleware';

const pathSchema = z.object({
  axiomId: z.string().min(1),
});

type Path = z.infer<typeof pathSchema>;

const handler = async (event: ValidatedAPIGatewayProxyEvent<unknown, Path>, context: Context) => {
  const userId = getUserId(event);
  const { axiomId } = event.pathParameters;
  const axiomRepo = getAxiomRepository();

  logger.info('Deleting axiom', { userId, axiomId });

  // Check if axiom exists and belongs to user
  const existing = await axiomRepo.findById(userId, axiomId);
  if (!existing) {
    return response.notFound('Axiom not found');
  }

  // Cannot delete default axioms
  if (existing.isDefault) {
    return response.forbidden('Cannot delete default axioms');
  }

  await axiomRepo.delete(userId, axiomId);

  return response.noContent();
};

export const main = withMiddleware(handler, { pathSchema });
