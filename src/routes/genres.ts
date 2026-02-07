// Genre listing route
import { Router, Request, Response } from 'express';
import { bookIndex } from '../services/bookIndex';
import { logger, LogCategory } from '../logger/logger';

const router = Router();

// Helper to safely get query string
function getQueryParam(val: unknown): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return '';
}

// Helper to safely get route param
function getRouteParam(val: unknown): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return '';
}

// GET /genres - List all genres with book counts
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const genres = await bookIndex.getGenres();

    res.json({
      genres,
      total: genres.length
    });

  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Genres error', { error });
    res.status(500).json({ error: 'Failed to get genres' });
  }
});

// GET /genres/:genre - Get books in a specific genre
router.get('/:genre', async (req: Request, res: Response): Promise<void> => {
  try {
    const genre = getRouteParam(req.params.genre);
    const limit = parseInt(getQueryParam(req.query.limit) || '20');
    const offset = parseInt(getQueryParam(req.query.offset) || '0');

    const { results, total } = await bookIndex.search({ genre, limit, offset });

    res.json({
      genre,
      books: results.map(r => r.book),
      total,
      limit,
      offset,
      hasMore: offset + results.length < total
    });

  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Genre books error', { error });
    res.status(500).json({ error: 'Failed to get genre books' });
  }
});

export default router;
