// Series listing route
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

// GET /series - List all series with book counts
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(getQueryParam(req.query.limit) || '100');
    const series = await bookIndex.getSeries(limit);

    res.json({
      series,
      total: series.length
    });

  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Series error', { error });
    res.status(500).json({ error: 'Failed to get series' });
  }
});

// GET /series/:name - Get books in a specific series
router.get('/:name', async (req: Request, res: Response): Promise<void> => {
  try {
    const name = decodeURIComponent(getRouteParam(req.params.name));
    const books = await bookIndex.getSeriesBooks(name);

    res.json({
      series: name,
      books: books.map(b => ({
        id: b.id,
        title: b.title,
        seriesNum: b.seriesNum,
        authors: b.authors,
        rating: b.rating
      })),
      total: books.length
    });

  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Series books error', { error });
    res.status(500).json({ error: 'Failed to get series books' });
  }
});

export default router;
