// Stats route
import { Router, Request, Response } from 'express';
import { bookIndex } from '../services/bookIndex';
import { logger, LogCategory } from '../logger/logger';

const router = Router();

// GET /stats - Get index statistics
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await bookIndex.getStats();

    if (!stats) {
      res.status(503).json({
        error: 'Index not ready',
        ready: bookIndex.isReady()
      });
      return;
    }

    res.json({
      ...stats,
      ready: bookIndex.isReady()
    });

  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Stats error', { error });
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
