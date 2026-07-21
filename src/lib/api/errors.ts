import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ServiceConfigurationError } from '@/lib/supabase/config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST', message: 'The request data is invalid.' } },
      { status: 400 },
    );
  }

  if (error instanceof ServiceConfigurationError) {
    return NextResponse.json(
      { error: { code: error.code, message: 'This service is temporarily unavailable.' } },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } },
    { status: 500 },
  );
}

export async function parseJsonRequest(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
  }

  try {
    return await request.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'The request body must contain valid JSON.');
  }
}
