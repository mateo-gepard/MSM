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

function codedErrorResponse(code: string, status: number): NextResponse {
  return NextResponse.json(
    { error: { code } },
    {
      status,
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    },
  );
}

export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return codedErrorResponse(error.code, error.status);
  }

  if (error instanceof ZodError) {
    return codedErrorResponse('INVALID_REQUEST', 400);
  }

  if (error instanceof ServiceConfigurationError) {
    return codedErrorResponse(error.code, 503);
  }

  return codedErrorResponse('INTERNAL_ERROR', 500);
}

async function readBoundedBody(request: Request, maxBytes: number): Promise<string> {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    if (!/^\d+$/.test(contentLength)) {
      throw new ApiError(400, 'INVALID_REQUEST', 'Content-Length must be a positive integer.');
    }
    if (Number(contentLength) > maxBytes) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
    }
  }

  if (!request.body) return '';
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = '';
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return body;
  } finally {
    reader.releaseLock();
  }
}

export async function parseJsonRequest(
  request: Request,
  options: { maxBytes?: number } = {},
): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json.');
  }

  try {
    if (
      options.maxBytes !== undefined &&
      (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0)
    ) {
      throw new TypeError('maxBytes must be a positive safe integer');
    }
    const body =
      options.maxBytes === undefined
        ? await request.text()
        : await readBoundedBody(request, options.maxBytes);
    return JSON.parse(body);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'INVALID_JSON', 'The request body must contain valid JSON.');
  }
}
