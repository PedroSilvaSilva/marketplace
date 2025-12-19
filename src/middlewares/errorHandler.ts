import { Request, Response, NextFunction } from 'express';
import { AppError } from '@utils/errors';
import { errorResponse } from '@utils/response';
import logger from '@config/logger';
import { config } from '@config/index';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Handle AppError (operational errors)
  if (err instanceof AppError) {
    return errorResponse(res, err.message, err.statusCode);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Invalid token', 401, 'INVALID_TOKEN');
  }

  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Token expired', 401, 'TOKEN_EXPIRED');
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    return errorResponse(res, 'Database error', 400, 'DATABASE_ERROR');
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return errorResponse(res, err.message, 400, 'VALIDATION_ERROR');
  }

  // Default to 500 server error
  const statusCode = 500;
  const message = config.app.isProduction 
    ? 'Internal server error' 
    : err.message;

  return errorResponse(res, message, statusCode, 'INTERNAL_SERVER_ERROR');
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  return errorResponse(res, `Route ${req.originalUrl} not found`, 404, 'NOT_FOUND');
};
