import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import type { ApiErrorCode, ApiResponse } from '@/src/lib/integrations/core/types';
import { IntegrationError } from '@/src/lib/integrations/core/errors';
import { logger } from '@/src/lib/integrations/utils/logger';

export const ok = <T>(message: string, data: T, status = 200): NextResponse<ApiResponse<T>> =>
  NextResponse.json(
    {
      success: true,
      message,
      data,
    },
    { status }
  );

export const fail = (errorCode: ApiErrorCode, message: string, status = 400) =>
  NextResponse.json(
    {
      success: false,
      errorCode,
      message,
    },
    { status }
  );

export const toErrorResponse = (error: unknown, fallbackMessage = 'Unexpected server error.') => {
  if (error instanceof IntegrationError) {
    return fail(error.errorCode, error.message, error.statusCode);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const code = (error as { code?: string }).code;
    if (code === 'P2021' || code === 'P2022') {
      return fail(
        'CONFIGURATION_ERROR',
        'Database schema is not initialized. Run Prisma migrations.',
        500
      );
    }
    if (code === 'P1001' || code === 'P1002') {
      return fail('CONFIGURATION_ERROR', 'Database is unreachable. Check DATABASE_URL and network.', 503);
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return fail('CONFIGURATION_ERROR', 'Database initialization failed. Check DATABASE_URL and adapter.', 500);
  }

  logger.error('Unhandled API error', {
    fallbackMessage,
    message: error instanceof Error ? error.message : String(error),
  });
  return fail('INTERNAL_ERROR', fallbackMessage, 500);
};
