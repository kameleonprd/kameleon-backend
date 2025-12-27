import { IAxiomRepository } from '../../application/ports/repositories/axiom-repository';
import { DynamoAxiomRepository } from '../../infrastructure/repositories/dynamo-axiom-repository';

// Singleton instances (cached for Lambda warm starts)
let axiomRepository: IAxiomRepository | null = null;

export function getAxiomRepository(): IAxiomRepository {
  if (!axiomRepository) {
    axiomRepository = new DynamoAxiomRepository();
  }
  return axiomRepository;
}

// Reset function for testing
export function resetContainer(): void {
  axiomRepository = null;
}
