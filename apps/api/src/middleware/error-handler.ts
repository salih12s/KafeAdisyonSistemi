import type { ErrorRequestHandler } from 'express';
import { API_ERROR_CODES, type ApiErrorCode, type ApiErrorResponse } from '@kafe/contracts';
import { AppError } from '../errors/app-error';
import type { Logger } from '../lib/logger';

interface NormalizedError {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  details: readonly string[] | undefined;
}

/** body-parser hataları HTTP durum kodunu `status` alanında taşır. */
function readErrorStatus(error: unknown): number | undefined {
  if (error instanceof Error && 'status' in error && typeof error.status === 'number') {
    return error.status;
  }

  return undefined;
}

function normalize(error: unknown, exposeInternalMessage: boolean): NormalizedError {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  const bodyParserStatus = readErrorStatus(error);

  if (error instanceof SyntaxError && bodyParserStatus !== undefined) {
    return {
      statusCode: 400,
      code: API_ERROR_CODES.VALIDATION_ERROR,
      message: 'İstek gövdesi geçerli bir JSON değil.',
      details: undefined,
    };
  }

  if (bodyParserStatus === 413) {
    return {
      statusCode: 413,
      code: API_ERROR_CODES.PAYLOAD_TOO_LARGE,
      message: 'İstek gövdesi izin verilen sınırdan büyük.',
      details: undefined,
    };
  }

  const fallback = 'Sunucuda beklenmeyen bir hata oluştu.';

  return {
    statusCode: 500,
    code: API_ERROR_CODES.INTERNAL_ERROR,
    message: exposeInternalMessage && error instanceof Error ? error.message : fallback,
    details: undefined,
  };
}

/**
 * Merkezî hata yönetimi. Yanıt gövdesi her zaman ApiErrorResponse biçimindedir;
 * stack trace istemciye hiçbir ortamda gönderilmez.
 */
export function createErrorHandler(logger: Logger, exposeInternalMessage: boolean): ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const normalized = normalize(error, exposeInternalMessage);

    if (normalized.statusCode >= 500) {
      logger.error('İstek işlenirken hata oluştu.', {
        method: req.method,
        path: req.originalUrl,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } else {
      logger.warn('İstek reddedildi.', {
        method: req.method,
        path: req.originalUrl,
        statusCode: normalized.statusCode,
        code: normalized.code,
      });
    }

    const body: ApiErrorResponse = {
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.details === undefined ? {} : { details: normalized.details }),
      },
    };

    res.status(normalized.statusCode).json(body);
  };
}
