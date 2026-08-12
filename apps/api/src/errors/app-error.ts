import { API_ERROR_CODES, type ApiErrorCode } from '@kafe/contracts';

/** İstemciye gösterilmesi güvenli olan, bilinen uygulama hatası. */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;
  public readonly details: readonly string[] | undefined;

  constructor(
    message: string,
    statusCode = 500,
    code: ApiErrorCode = API_ERROR_CODES.INTERNAL_ERROR,
    details?: readonly string[],
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, API_ERROR_CODES.NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: readonly string[]) {
    super(message, 400, API_ERROR_CODES.VALIDATION_ERROR, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Oturum açmanız gerekiyor.') {
    super(message, 401, API_ERROR_CODES.UNAUTHORIZED);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Bu işlem için yetkiniz bulunmuyor.') {
    super(message, 403, API_ERROR_CODES.FORBIDDEN);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, API_ERROR_CODES.CONFLICT);
    this.name = 'ConflictError';
  }
}
