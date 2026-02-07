// Language listing route
import { Router, Request, Response } from 'express';
import { bookIndex } from '../services/bookIndex';
import { logger, LogCategory } from '../logger/logger';

const router = Router();

// GET /languages - List all languages with book counts
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const languages = await bookIndex.getLanguages();

    res.json({
      languages,
      total: languages.length
    });

  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Languages error', { error });
    res.status(500).json({ error: 'Failed to get languages' });
  }
});

export default router;
