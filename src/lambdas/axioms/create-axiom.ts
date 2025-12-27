import { withMiddleware, response, getUserId, logger, z } from '../shared/middleware';
import { getAxiomRepository } from '../../shared/di/container';
import type { Context } from 'aws-lambda';
import type { ValidatedAPIGatewayProxyEvent } from '../shared/middleware';

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

type Body = z.infer<typeof bodySchema>;

const handler = async (event: ValidatedAPIGatewayProxyEvent<Body>, context: Context) => {
  const userId = getUserId(event);
  const axiomRepo = getAxiomRepository();

  logger.info('Creating axiom', { userId, name: event.body.name });

  const axiom = await axiomRepo.create(userId, event.body);

  return response.created({ axiom, message: 'Axiom created successfully' });
};

export const main = withMiddleware(handler, { bodySchema });
