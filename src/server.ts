import express, { Express } from 'express';
import cors from 'cors';
import { logger, LogCategory } from './logger/logger';
import { requestLogger } from './middleware/requestLogger';
import healthRouter from './routes/health';
import inspectRouter from './routes/inspect';
import extractionRouter from './routes/extraction';
import { cacheService } from './services/cacheService';
import { processManager } from './services/processManager';

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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'PARDES API',
    version: '1.0.0',
    description: 'Paradise Library - A gateway to forbidden knowledge',
    endpoints: {
      health: '/health - System health and extraction progress',
      inspect: '/inspect - Security inspection of extracted cache',
      extraction: '/extraction/progress - Detailed extraction progress',
      // More endpoints will be added here
    }
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

    // Extract book archives in BACKGROUND (non-blocking)
    console.log('📦 Starting background extraction...');
    cacheService.initialize()
      .then((extractionStats) => {
        logger.info(LogCategory.SYSTEM, 'Book extraction complete', extractionStats);
        console.log(`\n✅ Extraction complete!`);
        console.log(`📚 Extracted ${extractionStats.totalFiles} files from ${extractionStats.archives.length} archive(s)`);
        console.log(`📊 Total size: ${Math.round(extractionStats.totalSize / 1024 / 1024)}MB`);

        if (extractionStats.warnings.length > 0) {
          console.log(`⚠️  ${extractionStats.warnings.length} warning(s) - check logs for details`);
        }

        console.log(`\n🎉 PARDES fully initialized!\n`);
      })
      .catch((error) => {
        logger.error(LogCategory.SYSTEM, 'Background extraction failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        console.error('\n❌ Extraction failed:', error.message);
        console.log('⚠️  Server still running, but library may be incomplete\n');
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
