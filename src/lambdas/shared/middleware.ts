import middy from '@middy/core';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import httpErrorHandler from '@middy/http-error-handler';
import httpCors from '@middy/http-cors';
import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { injectLambdaContext } from '@aws-lambda-powertools/logger/middleware';
import { logMetrics } from '@aws-lambda-powertools/metrics/middleware';
import { captureLambdaHandler } from '@aws-lambda-powertools/tracer/middleware';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context, Handler } from 'aws-lambda';
import { ZodSchema, ZodError } from 'zod';

// ============================================================
// Powertools Instances (Singleton)
// ============================================================

const serviceName = process.env.SERVICE_NAME || 'kameleon-backend';
const environment = process.env.ENVIRONMENT || 'dev';
const isDevEnvironment = environment === 'dev';

export const logger = new Logger({
  serviceName,
  logLevel: (process.env.LOG_LEVEL as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SILENT') || 'INFO',
  persistentLogAttributes: {
    environment,
  },
});

export const metrics = new Metrics({
  serviceName,
  namespace: 'Kameleon',
  defaultDimensions: {
    environment,
  },
});

export const tracer = new Tracer({
  serviceName,
  captureHTTPsRequests: true,
});

// ============================================================
// Types
// ============================================================

export interface MiddlewareOptions {
  bodySchema?: ZodSchema;
  pathSchema?: ZodSchema;
  querySchema?: ZodSchema;
  corsOrigins?: string[];
}

export interface ValidatedAPIGatewayProxyEvent<TBody = unknown, TPath = unknown, TQuery = unknown>
  extends Omit<APIGatewayProxyEvent, 'body' | 'pathParameters' | 'queryStringParameters'> {
  body: TBody;
  pathParameters: TPath;
  queryStringParameters: TQuery;
}

export type ValidatedHandler<TBody = unknown, TPath = unknown, TQuery = unknown> = (
  event: ValidatedAPIGatewayProxyEvent<TBody, TPath, TQuery>,
  context: Context
) => Promise<APIGatewayProxyResult>;

// ============================================================
// Get User ID from Cognito Claims
// ============================================================

export function getUserId(event: APIGatewayProxyEvent): string {
  const claims = event.requestContext?.authorizer?.claims;
  const userId = claims?.sub;
  if (!userId) {
    throw new Error('User ID not found in claims');
  }
  return userId;
}

// ============================================================
// Custom Middleware: Zod Validation
// ============================================================

const zodValidator = (options: MiddlewareOptions): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const before: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request): Promise<APIGatewayProxyResult | void> => {
    const { event } = request;

    try {
      if (options.bodySchema && event.body) {
        const parsed = options.bodySchema.parse(event.body);
        (event as unknown as ValidatedAPIGatewayProxyEvent).body = parsed;
      }

      if (options.pathSchema && event.pathParameters) {
        const parsed = options.pathSchema.parse(event.pathParameters);
        (event as unknown as ValidatedAPIGatewayProxyEvent).pathParameters = parsed;
      }

      if (options.querySchema && event.queryStringParameters) {
        const parsed = options.querySchema.parse(event.queryStringParameters);
        (event as unknown as ValidatedAPIGatewayProxyEvent).queryStringParameters = parsed;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Request validation failed', {
          errorCount: error.errors.length,
          fields: error.errors.map(e => e.path.join('.')),
        });

        return {
          statusCode: 400,
          headers: getCorsHeaders(),
          body: JSON.stringify({
            error: 'Validation Error',
            message: 'Invalid request data',
            details: error.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          }),
        };
      }
      throw error;
    }
    return;
  };

  return { before };
};

// ============================================================
// Custom Middleware: Request Logging
// ============================================================

const requestLogger = (): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
  const before: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request) => {
    const { event, context } = request;
    const claims = event.requestContext?.authorizer?.claims;
    const userId = claims?.sub;

    const correlationId =
      event.headers?.['X-Correlation-Id'] ||
      event.headers?.['x-correlation-id'] ||
      event.requestContext?.requestId ||
      `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    (context as Context & { correlationId?: string; startTime?: number }).correlationId = correlationId;
    (context as Context & { startTime?: number }).startTime = Date.now();

    logger.appendKeys({
      correlationId,
      requestId: event.requestContext?.requestId,
      path: event.path,
      method: event.httpMethod,
      userId,
    });

    if (userId) {
      tracer.putAnnotation('userId', userId);
    }

    logger.info('Request received', {
      path: event.path,
      method: event.httpMethod,
      hasBody: !!event.body,
    });
  };

  const after: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request) => {
    const { response, context } = request;
    const startTime = (context as Context & { startTime?: number }).startTime;
    const correlationId = (context as Context & { correlationId?: string }).correlationId;
    const duration = startTime ? Date.now() - startTime : undefined;

    if (response && correlationId) {
      response.headers = {
        ...response.headers,
        'X-Correlation-Id': correlationId,
      };
    }

    logger.info('Request completed', {
      statusCode: response?.statusCode,
      duration,
    });
  };

  const onError: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> = async (request) => {
    const { error } = request;

    logger.error('Request failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      ...(isDevEnvironment && error instanceof Error ? { stack: error.stack } : {}),
    });
  };

  return { before, after, onError };
};

// ============================================================
// Main Middleware Wrapper
// ============================================================

export function withMiddleware<TBody = unknown, TPath = unknown, TQuery = unknown>(
  handler: ValidatedHandler<TBody, TPath, TQuery>,
  options: MiddlewareOptions = {}
): middy.MiddyfiedHandler<APIGatewayProxyEvent, APIGatewayProxyResult> {
  const defaultOrigins = isDevEnvironment
    ? ['http://localhost:3000', 'http://localhost:3001']
    : ['*'];

  const corsOrigins = options.corsOrigins || defaultOrigins;

  return middy(handler as unknown as Handler<APIGatewayProxyEvent, APIGatewayProxyResult>)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger, { clearState: true }))
    .use(logMetrics(metrics, { captureColdStartMetric: true }))
    .use(httpJsonBodyParser({ disableContentTypeError: true }))
    .use(httpCors({
      origins: corsOrigins,
      credentials: true,
      headers: 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    }))
    .use(requestLogger())
    .use(zodValidator(options))
    .use(httpErrorHandler({
      logger: (error) => {
        logger.error('Unhandled error', {
          errorMessage: error.message,
          errorName: error.name,
          ...(isDevEnvironment ? { stack: error.stack } : {}),
        });
      },
    }));
}

// ============================================================
// CORS Headers Helper
// ============================================================

const getCorsHeaders = (): Record<string, string> => ({
  'Access-Control-Allow-Origin': isDevEnvironment ? 'http://localhost:3000' : '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
});

// ============================================================
// Response Helpers
// ============================================================

export const response = {
  success: <T>(data: T, statusCode = 200): APIGatewayProxyResult => ({
    statusCode,
    body: JSON.stringify(data),
  }),

  created: <T>(data: T): APIGatewayProxyResult => ({
    statusCode: 201,
    body: JSON.stringify(data),
  }),

  noContent: (): APIGatewayProxyResult => ({
    statusCode: 204,
    body: '',
  }),

  badRequest: (message: string, details?: unknown): APIGatewayProxyResult => ({
    statusCode: 400,
    headers: getCorsHeaders(),
    body: JSON.stringify({ error: 'Bad Request', message, details }),
  }),

  unauthorized: (message = 'Unauthorized'): APIGatewayProxyResult => ({
    statusCode: 401,
    headers: getCorsHeaders(),
    body: JSON.stringify({ error: 'Unauthorized', message }),
  }),

  forbidden: (message = 'Forbidden'): APIGatewayProxyResult => ({
    statusCode: 403,
    headers: getCorsHeaders(),
    body: JSON.stringify({ error: 'Forbidden', message }),
  }),

  notFound: (message = 'Resource not found'): APIGatewayProxyResult => ({
    statusCode: 404,
    headers: getCorsHeaders(),
    body: JSON.stringify({ error: 'Not Found', message }),
  }),

  conflict: (message: string): APIGatewayProxyResult => ({
    statusCode: 409,
    headers: getCorsHeaders(),
    body: JSON.stringify({ error: 'Conflict', message }),
  }),

  internalError: (message = 'Internal server error'): APIGatewayProxyResult => ({
    statusCode: 500,
    headers: getCorsHeaders(),
    body: JSON.stringify({ error: 'Internal Server Error', message }),
  }),
};

// ============================================================
// Re-export for convenience
// ============================================================

export { z } from 'zod';
export { MetricUnit } from '@aws-lambda-powertools/metrics';
export type { ZodSchema } from 'zod';
