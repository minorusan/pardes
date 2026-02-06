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
    logger.debug(LogCategory.API, 'Health check requested', {
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    const sessionStart = logger.getSessionStart();
    const healthStatus = await systemStatsService.getHealthStatus(sessionStart);

    logger.info(LogCategory.API, 'Health check completed', {
      status: healthStatus.status,
      cpuUsage: healthStatus.system.cpu.usage,
      memoryUsage: healthStatus.system.memory.usagePercent
    });

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
