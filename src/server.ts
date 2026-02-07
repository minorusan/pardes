import express, { Express } from 'express';
import cors from 'cors';
import { logger, LogCategory } from './logger/logger';
import { requestLogger } from './middleware/requestLogger';
import healthRouter from './routes/health';
import inspectRouter from './routes/inspect';
import extractionRouter from './routes/extraction';
import booksRouter from './routes/books';
import genresRouter from './routes/genres';
import statsRouter from './routes/stats';
import languagesRouter from './routes/languages';
import seriesRouter from './routes/series';
import authorsRouter from './routes/authors';
import { cacheService } from './services/cacheService';
import { processManager } from './services/processManager';
import { bookIndex } from './services/bookIndex';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Routes
app.use('/health', healthRouter);
app.use('/inspect', inspectRouter);
app.use('/extraction', extractionRouter);
app.use('/books', booksRouter);
app.use('/genres', genresRouter);
app.use('/stats', statsRouter);
app.use('/languages', languagesRouter);
app.use('/series', seriesRouter);
app.use('/authors', authorsRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'PARDES API',
    version: '2.0.0',
    description: 'Paradise Library - A gateway to forbidden knowledge',
    endpoints: {
      books: {
        search: 'GET /books?q=<query> - Fuzzy search books',
        byTitle: 'GET /books?title=<title> - Search by title',
        byAuthor: 'GET /books?author=<author> - Search by author',
        byGenre: 'GET /books?genre=<genre> - Filter by genre',
        random: 'GET /books/random?count=10 - Random books for discovery',
        top: 'GET /books/top?limit=20 - Top rated books',
        getBook: 'GET /books/:id - Get book details + series + author info',
        download: 'GET /books/:id/download - Download FB2 file',
        read: 'GET /books/:id/read - Parsed chapters for reading',
        content: 'GET /books/:id/content - Raw text excerpt'
      },
      genres: {
        list: 'GET /genres - List all genres with counts',
        books: 'GET /genres/:genre - Get books in genre'
      },
      series: {
        list: 'GET /series - List all series with counts',
        books: 'GET /series/:name - Get books in series (ordered)'
      },
      authors: {
        books: 'GET /authors/:name - All books by author (grouped by series)'
      },
      languages: 'GET /languages - Available languages with counts',
      stats: 'GET /stats - Index statistics',
      health: 'GET /health - System health'
    },
    ready: bookIndex.isReady()
  });
});

// Graceful shutdown handler (doesn't nuke the terminal)
let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n\n👋 Received ${signal}, cleaning up...`);
  logger.info(LogCategory.SYSTEM, `Received ${signal}, cleaning up...`);

  try {
    // Kill any child processes
    await processManager.cleanup();
    logger.info(LogCategory.SYSTEM, 'Process cleanup complete');
  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Error during process cleanup', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Don't clean cache on shutdown - it's valid for next startup!
  // Only clean it if we detect corruption or hash mismatch

  // TODO: Close database connections

  logger.info(LogCategory.SYSTEM, 'Cleanup complete');
  console.log('✅ Cleanup complete\n');

  // Exit cleanly (code 0) without nuking terminal
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Initialize and start server (modern non-blocking way)
const startServer = async () => {
  try {
    logger.info(LogCategory.SYSTEM, 'Starting PARDES initialization...');

    // Kill any zombie processes from previous runs
    console.log('🧟 Checking for zombie processes...');
    await processManager.initialize();

    // Start HTTP server FIRST (non-blocking)
    app.listen(PORT, () => {
      logger.info(LogCategory.SYSTEM, `PARDES API started on port ${PORT}`, {
        port: PORT,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
      });

      console.log(`\n🌳 PARDES API running on http://localhost:${PORT}`);
      console.log(`📝 Logs: ${logger.getLogFilePath()}`);
      console.log(`💾 Cache: ${cacheService.getCacheDir()}`);
      console.log(`✨ Server ready - extraction running in background...\n`);
    });

    // Initialize book index in BACKGROUND (non-blocking)
    console.log('📚 Starting book index initialization...');
    bookIndex.initialize()
      .then(async () => {
        const stats = await bookIndex.getStats();
        logger.info(LogCategory.SYSTEM, 'Book index ready', stats);
        console.log(`\n✅ Book index ready!`);
        console.log(`📚 Indexed ${stats?.totalBooks || 0} books`);
        console.log(`👤 ${stats?.totalAuthors || 0} authors`);
        console.log(`🏷️  ${stats?.totalGenres || 0} genres`);
        console.log(`\n🎉 PARDES fully initialized!\n`);
      })
      .catch((error) => {
        logger.error(LogCategory.SYSTEM, 'Book index initialization failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        console.error('\n❌ Index initialization failed:', error.message);
        console.log('⚠️  Server still running, but search may not work\n');
      });

  } catch (error) {
    logger.error(LogCategory.SYSTEM, 'Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    console.error('❌ Failed to start PARDES:', error);
    console.error('\nPress Ctrl+C to exit');
    // Don't force exit - let user see the error
  }
};

startServer();

export default app;
