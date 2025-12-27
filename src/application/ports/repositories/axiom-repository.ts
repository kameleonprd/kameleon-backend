import { Axiom, CreateAxiomInput, UpdateAxiomInput } from '../../../domain/entities/axiom';

export interface IAxiomRepository {
  findByUserId(userId: string): Promise<Axiom[]>;
  findById(userId: string, axiomId: string): Promise<Axiom | null>;
  findDefaults(): Promise<Axiom[]>;
  create(userId: string, input: CreateAxiomInput): Promise<Axiom>;
  update(userId: string, axiomId: string, input: UpdateAxiomInput): Promise<Axiom>;
  delete(userId: string, axiomId: string): Promise<void>;
}
