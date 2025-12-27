import { withMiddleware, response, getUserId, logger, z } from '../shared/middleware';
import { getAxiomRepository } from '../../shared/di/container';
import type { Context } from 'aws-lambda';
import type { ValidatedAPIGatewayProxyEvent } from '../shared/middleware';

const pathSchema = z.object({
  axiomId: z.string().min(1),
});

const bodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

type Path = z.infer<typeof pathSchema>;
type Body = z.infer<typeof bodySchema>;

const handler = async (event: ValidatedAPIGatewayProxyEvent<Body, Path>, context: Context) => {
  const userId = getUserId(event);
  const { axiomId } = event.pathParameters;
  const axiomRepo = getAxiomRepository();

  logger.info('Updating axiom', { userId, axiomId });

  // Check if axiom exists and belongs to user
  const existing = await axiomRepo.findById(userId, axiomId);
  if (!existing) {
    return response.notFound('Axiom not found');
  }

  // Cannot update default axioms
  if (existing.isDefault) {
    return response.forbidden('Cannot update default axioms');
  }

  const axiom = await axiomRepo.update(userId, axiomId, event.body);

  return response.success({ axiom, message: 'Axiom updated successfully' });
};

export const main = withMiddleware(handler, { pathSchema, bodySchema });
