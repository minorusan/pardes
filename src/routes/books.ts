// Book search and download routes
import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as iconv from 'iconv-lite';
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

// GET /books/random - Get random books for discovery
router.get('/random', async (req: Request, res: Response): Promise<void> => {
  try {
    const count = Math.min(parseInt(getQueryParam(req.query.count) || '10'), 50);
    const genre = getQueryParam(req.query.genre) || undefined;
    const lang = getQueryParam(req.query.lang) || undefined;

    const books = await bookIndex.getRandomBooks(count, { genre, language: lang });

    res.json({
      books,
      count: books.length
    });

  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Random books error', { error });
    res.status(500).json({ error: 'Failed to get random books' });
  }
});

// GET /books/top - Get top rated books
router.get('/top', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(getQueryParam(req.query.limit) || '20'), 100);
    const genre = getQueryParam(req.query.genre) || undefined;

    const books = await bookIndex.getTopRated(limit, genre);

    res.json({
      books,
      count: books.length
    });

  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Top books error', { error });
    res.status(500).json({ error: 'Failed to get top books' });
  }
});

// GET /books - Search books
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const options = {
      query: getQueryParam(req.query.q) || undefined,
      title: getQueryParam(req.query.title) || undefined,
      author: getQueryParam(req.query.author) || undefined,
      genre: getQueryParam(req.query.genre) || undefined,
      language: getQueryParam(req.query.lang) || undefined,
      limit: parseInt(getQueryParam(req.query.limit) || '20'),
      offset: parseInt(getQueryParam(req.query.offset) || '0'),
      sort: getQueryParam(req.query.sort) || undefined, // title, rating, date, size
      order: getQueryParam(req.query.order) || 'desc' // asc, desc
    };

    // At least one search parameter required
    if (!options.query && !options.title && !options.author && !options.genre) {
      res.status(400).json({
        error: 'At least one search parameter required',
        params: ['q', 'title', 'author', 'genre'],
        example: '/books?q=война+и+мир'
      });
      return;
    }

    const { results, total } = await bookIndex.search(options);

    res.json({
      results: results.map(r => ({
        ...r.book,
        score: Math.round(r.score * 100) / 100,
        matchType: r.matchType
      })),
      total,
      limit: options.limit,
      offset: options.offset,
      hasMore: options.offset + results.length < total
    });

  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Search error', { error });
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /books/:id - Get book by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = getRouteParam(req.params.id);
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }

    const book = await bookIndex.getBook(id);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    // Get series info if book is part of a series
    let seriesBooks = undefined;
    if (book.series) {
      seriesBooks = await bookIndex.getSeriesBooks(book.series);
    }

    // Get other books by same author
    const authorBooks = await bookIndex.getAuthorBooks(book.authors[0]?.lastName, 5, id);

    res.json({
      ...book,
      seriesBooks: seriesBooks?.map(b => ({ id: b.id, title: b.title, seriesNum: b.seriesNum })),
      moreByAuthor: authorBooks?.map(b => ({ id: b.id, title: b.title }))
    });

  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Get book error', { error });
    res.status(500).json({ error: 'Failed to get book' });
  }
});

// GET /books/:id/download - Download book file
router.get('/:id/download', async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = getRouteParam(req.params.id);
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }

    const book = await bookIndex.getBook(id);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const filePath = await bookIndex.getBookPath(id);
    if (!filePath) {
      res.status(404).json({ error: 'Book file not found' });
      return;
    }

    // Set filename with author and title
    const authorName = book.authors[0]?.lastName || 'Unknown';
    const safeTitle = book.title.replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '').substring(0, 50);
    const filename = `${authorName} - ${safeTitle}.fb2`;

    res.setHeader('Content-Type', 'application/xml; charset=windows-1251');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', book.size);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Download error', { error });
    res.status(500).json({ error: 'Download failed' });
  }
});

// GET /books/:id/read - Get book content as structured JSON for reading
router.get('/:id/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = getRouteParam(req.params.id);
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }

    const book = await bookIndex.getBook(id);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const filePath = await bookIndex.getBookPath(id);
    if (!filePath) {
      res.status(404).json({ error: 'Book file not found' });
      return;
    }

    // Parse FB2 and return structured content
    const content = await bookIndex.parseBookContent(filePath);

    res.json({
      id,
      title: book.title,
      authors: book.authors,
      ...content
    });

  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Read error', { error });
    res.status(500).json({ error: 'Failed to parse book' });
  }
});

// GET /books/:id/cover - Get book cover image
router.get('/:id/cover', async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = getRouteParam(req.params.id);
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }

    const filePath = await bookIndex.getBookPath(id);
    if (!filePath) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    // Read file and extract cover
    const content = fs.readFileSync(filePath);
    const header = content.slice(0, 200).toString('ascii');
    const encodingMatch = header.match(/encoding=["']([^"']+)["']/i);
    const encoding = encodingMatch ? encodingMatch[1].toLowerCase() : 'windows-1251';
    const xml = iconv.decode(content, encoding === 'utf-8' ? 'utf-8' : 'win1251');

    // Try to find cover image (various patterns)
    let coverBase64: string | null = null;
    let contentType = 'image/jpeg';

    // Pattern 1: binary with id containing "cover"
    const coverMatch = xml.match(/<binary[^>]*id="([^"]*cover[^"]*)"[^>]*content-type="(image\/[^"]+)"[^>]*>([\s\S]*?)<\/binary>/i);
    if (coverMatch) {
      contentType = coverMatch[2];
      coverBase64 = coverMatch[3].replace(/\s/g, '');
    }

    // Pattern 2: first binary image if no cover found
    if (!coverBase64) {
      const imgMatch = xml.match(/<binary[^>]*content-type="(image\/[^"]+)"[^>]*>([\s\S]*?)<\/binary>/i);
      if (imgMatch) {
        contentType = imgMatch[1];
        coverBase64 = imgMatch[2].replace(/\s/g, '');
      }
    }

    if (!coverBase64) {
      res.status(404).json({ error: 'No cover image found' });
      return;
    }

    // Send as image
    const imageBuffer = Buffer.from(coverBase64, 'base64');
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.send(imageBuffer);

  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Cover error', { error });
    res.status(500).json({ error: 'Failed to get cover' });
  }
});

// GET /books/:id/content - Get book content as text (for reading/indexing)
router.get('/:id/content', async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = getRouteParam(req.params.id);
    const id = parseInt(idParam, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }

    const filePath = await bookIndex.getBookPath(id);
    if (!filePath) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    // Read file and convert from windows-1251 to UTF-8
    const content = fs.readFileSync(filePath);

    // Detect encoding from XML declaration
    const header = content.slice(0, 200).toString('ascii');
    const encodingMatch = header.match(/encoding=["']([^"']+)["']/i);
    const encoding = encodingMatch ? encodingMatch[1].toLowerCase() : 'windows-1251';

    // Try to extract just the text content from FB2 XML
    const xml = iconv.decode(content, encoding === 'utf-8' ? 'utf-8' : 'win1251');
    const textMatch = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

    if (textMatch) {
      // Strip XML tags, keep text
      let text = textMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Limit response size
      const maxLen = parseInt(getQueryParam(req.query.maxlen) || '10000');
      if (text.length > maxLen) {
        text = text.substring(0, maxLen) + '...';
      }

      res.json({
        id,
        excerpt: text,
        truncated: text.length >= maxLen
      });
    } else {
      res.status(500).json({ error: 'Could not extract text content' });
    }

  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Content extraction error', { error });
    res.status(500).json({ error: 'Failed to extract content' });
  }
});

export default router;
