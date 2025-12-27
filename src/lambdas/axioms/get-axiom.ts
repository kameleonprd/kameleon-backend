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

  logger.info('Getting axiom', { userId, axiomId });

  const axiom = await axiomRepo.findById(userId, axiomId);

  if (!axiom) {
    return response.notFound('Axiom not found');
  }

  return response.success({ axiom });
};

export const main = withMiddleware(handler, { pathSchema });
