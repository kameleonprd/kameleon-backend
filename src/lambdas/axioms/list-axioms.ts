import { withMiddleware, response, getUserId, logger } from '../shared/middleware';
import { getAxiomRepository } from '../../shared/di/container';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

const handler = async (event: APIGatewayProxyEvent, context: Context) => {
  const userId = getUserId(event);
  const axiomRepo = getAxiomRepository();

  logger.info('Listing axioms for user', { userId });

  // Get user's custom axioms
  const userAxioms = await axiomRepo.findByUserId(userId);

  // Get default system axioms
  const defaultAxioms = await axiomRepo.findDefaults();

  // Combine and sort by sortOrder
  const allAxioms = [...defaultAxioms, ...userAxioms].sort((a, b) => a.sortOrder - b.sortOrder);

  return response.success({
    items: allAxioms,
    counts: {
      total: allAxioms.length,
      custom: userAxioms.length,
      default: defaultAxioms.length,
    },
  });
};

export const main = withMiddleware(handler);
