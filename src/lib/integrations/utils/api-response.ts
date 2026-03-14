import { NextResponse } from 'next/server';
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

  logger.error('Unhandled API error', {
    fallbackMessage,
    message: error instanceof Error ? error.message : String(error),
  });
  return fail('INTERNAL_ERROR', fallbackMessage, 500);
};
