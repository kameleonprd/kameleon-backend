# Kameleon Backend

AWS CDK backend for Kameleon PRD Assistant.

## Tech Stack

| Component | Technology |
|-----------|------------|
| IaC | AWS CDK 2.150+ (TypeScript) |
| Runtime | Node.js 20.x (Lambda) |
| Database | DynamoDB (8 tables) |
| Auth | Cognito |
| AI | AWS Bedrock (Claude) |
| Middleware | Middy v5 |
| Validation | Zod |
| Observability | AWS Lambda Powertools |

## Project Structure

```
kameleon-backend/
├── bin/kameleon.ts              # CDK app entry point
├── lib/stacks/                  # CDK stacks
│   ├── auth-stack.ts            # Cognito User Pool
│   ├── database-stack.ts        # DynamoDB tables
│   └── api-stack.ts             # API Gateway + Lambda
├── src/
│   ├── domain/entities/         # Business entities
│   ├── application/ports/       # Repository/service interfaces
│   ├── infrastructure/          # AWS implementations
│   │   ├── clients/             # SDK clients
│   │   └── repositories/        # DynamoDB repositories
│   ├── shared/di/               # Dependency injection
│   └── lambdas/                 # API handlers
│       ├── shared/middleware.ts # Middy middleware
│       ├── axioms/              # Axiom handlers
│       ├── templates/           # Template handlers
│       ├── personas/            # Persona handlers
│       ├── documents/           # Document handlers
│       └── reviews/             # Review handlers
└── test/                        # Tests
```

## Commands

```bash
# Install dependencies
npm install

# Build
npm run build

# Deploy to dev
npm run deploy:dev

# Watch mode (hot-swap Lambda code)
npm run watch:cdk

# Synthesize CloudFormation
npm run synth

# Run tests
npm run test

# Lint
npm run lint
```

## Environment Configuration

Configured via `cdk.json` context:

| Environment | Branch | Removal Policy |
|-------------|--------|----------------|
| dev | dev | DESTROY |
| stage | stage | RETAIN |
| prod | main | RETAIN |

## Lambda Handler Pattern

All handlers use Middy middleware with Zod validation:

```typescript
import { withMiddleware, response, getUserId, z } from '../shared/middleware';

const bodySchema = z.object({
  name: z.string().min(1).max(100),
});

type Body = z.infer<typeof bodySchema>;

const handler = async (event: ValidatedAPIGatewayProxyEvent<Body>) => {
  const userId = getUserId(event);
  // Business logic...
  return response.success({ data });
};

export const main = withMiddleware(handler, { bodySchema });
```

## Repository Pattern

Use DI container for repositories:

```typescript
import { getAxiomRepository } from '../../shared/di/container';

const axiomRepo = getAxiomRepository();
const axioms = await axiomRepo.findByUserId(userId);
```

## Response Helpers

```typescript
response.success(data)           // 200
response.created(data)           // 201
response.noContent()             // 204
response.badRequest(message)     // 400
response.unauthorized(message)   // 401
response.forbidden(message)      // 403
response.notFound(message)       // 404
response.internalError(message)  // 500
```

## AWS Profile

Use profile `kama` for all AWS operations:

```bash
export AWS_PROFILE=kama
aws sso login --profile kama
```
