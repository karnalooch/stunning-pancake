/**
 * Unified application error types for API and GPS layers.
 */

export type AppErrorCode =
  | 'NETWORK'
  | 'AUTH'
  | 'GPS'
  | 'VALIDATION'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: AppErrorCode = 'UNKNOWN',
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
  }
}

export class NetworkAppError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'NETWORK', context);
    this.name = 'NetworkAppError';
  }
}

export class AuthAppError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'AUTH', context);
    this.name = 'AuthAppError';
  }
}

export class GpsAppError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'GPS', context);
    this.name = 'GpsAppError';
  }
}

export function toAppError(err: unknown, fallback = 'Unknown error'): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Error) return new AppError(err.message);
  return new AppError(fallback);
}

export function telemetryContext(err: AppError): Record<string, unknown> {
  return {
    code: err.code,
    message: err.message,
    ...err.context,
  };
}
