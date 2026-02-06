import { Router, Request, Response } from 'express';
import { cacheService } from '../services/cacheService';
import { logger, LogCategory } from '../logger/logger';

const router = Router();

/**
 * GET /extraction/progress
 * Get current extraction progress
 */
router.get('/progress', (req: Request, res: Response) => {
  try {
    const stats = cacheService.getStats();

    logger.debug(LogCategory.API, 'Extraction progress requested');

    res.json({
      inProgress: stats.inProgress,
      currentArchive: stats.currentArchiveProgress?.archive,
      progress: stats.currentArchiveProgress ? {
        archive: stats.currentArchiveProgress.archive,
        extractedMB: Math.round(stats.currentArchiveProgress.extractedSize / 1024 / 1024),
        expectedMB: Math.round(stats.currentArchiveProgress.expectedSize / 1024 / 1024),
        percentComplete: stats.currentArchiveProgress.percentComplete
      } : null,
      completed: {
        archives: stats.archives,
        skipped: stats.skippedArchives,
        totalFiles: stats.totalFiles,
        totalSizeMB: Math.round(stats.totalSize / 1024 / 1024)
      },
      cacheHit: stats.cacheHit,
      warnings: stats.warnings
    });
  } catch (error) {
    logger.error(LogCategory.API, 'Failed to get extraction progress', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Failed to retrieve extraction progress'
    });
  }
});

export default router;
