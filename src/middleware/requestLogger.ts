import { Request, Response, NextFunction } from 'express';
import { logger, LogCategory } from '../logger/logger';

// Paths that should not be logged on every hit
const SILENT_PATHS = new Set(['/health']);

/**
 * Middleware to log incoming HTTP requests.
 * Skips noisy endpoints (health checks) to prevent log spam.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  if (SILENT_PATHS.has(req.path)) {
    next();
    return;
  }

  const startTime = Date.now();

  // Log request
  logger.info(LogCategory.API, `${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip
  });

  // Capture response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';

    logger[logLevel](LogCategory.API, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
};
