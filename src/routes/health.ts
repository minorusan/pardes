import { Router, Request, Response } from 'express';
import { systemStatsService } from '../services/systemStats';
import { logger, LogCategory } from '../logger/logger';

const router = Router();

/**
 * GET /health
 * Returns comprehensive system health information
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const sessionStart = logger.getSessionStart();
    const healthStatus = await systemStatsService.getHealthStatus(sessionStart);
    res.json(healthStatus);
  } catch (error) {
    logger.error(LogCategory.API, 'Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to retrieve health status'
    });
  }
});

export default router;
