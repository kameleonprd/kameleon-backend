export interface Axiom {
  userId: string;
  axiomId: string;
  name: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAxiomInput {
  name: string;
  description: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateAxiomInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}
