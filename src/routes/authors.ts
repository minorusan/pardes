// Author listing route
import { Router, Request, Response } from 'express';
import { bookIndex } from '../services/bookIndex';
import { logger, LogCategory } from '../logger/logger';

const router = Router();

// Helper to safely get route param
function getRouteParam(val: unknown): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return '';
}

// GET /authors/:name - Get all books by author
router.get('/:name', async (req: Request, res: Response): Promise<void> => {
  try {
    const name = decodeURIComponent(getRouteParam(req.params.name));
    const books = await bookIndex.getAuthorBooks(name);

    // Group by series
    const seriesMap = new Map<string, typeof books>();
    const standalone: typeof books = [];

    for (const book of books) {
      if (book.series) {
        const existing = seriesMap.get(book.series) || [];
        existing.push(book);
        seriesMap.set(book.series, existing);
      } else {
        standalone.push(book);
      }
    }

    // Sort series books by series number
    for (const seriesBooks of seriesMap.values()) {
      seriesBooks.sort((a, b) => (a.seriesNum || 0) - (b.seriesNum || 0));
    }

    res.json({
      author: name,
      totalBooks: books.length,
      series: Array.from(seriesMap.entries()).map(([name, books]) => ({
        name,
        books: books.map(b => ({
          id: b.id,
          title: b.title,
          seriesNum: b.seriesNum,
          rating: b.rating
        }))
      })),
      standalone: standalone.map(b => ({
        id: b.id,
        title: b.title,
        genres: b.genres,
        rating: b.rating
      }))
    });

  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Author books error', { error });
    res.status(500).json({ error: 'Failed to get author books' });
  }
});

export default router;
