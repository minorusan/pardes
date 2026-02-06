import { Router, Request, Response } from 'express';
import { securityInspector } from '../services/securityInspector';
import { cacheService } from '../services/cacheService';
import { logger, LogCategory } from '../logger/logger';

const router = Router();

/**
 * GET /inspect
 * Perform security inspection of extracted cache
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    logger.info(LogCategory.API, 'Security inspection requested');

    const cacheDir = cacheService.getCacheDir();
    const report = await securityInspector.inspectCache(cacheDir);

    // Add file type identification for samples
    const enrichedLargeSamples = report.largeSamples.map(sample => ({
      ...sample,
      detectedType: securityInspector.identifyFileType(sample.firstBytes),
      sizeMB: Math.round(sample.size / 1024 / 1024 * 100) / 100
    }));

    const enrichedRandomSamples = report.randomSamples.map(sample => ({
      ...sample,
      detectedType: securityInspector.identifyFileType(sample.firstBytes),
      sizeMB: Math.round(sample.size / 1024 / 1024 * 100) / 100
    }));

    logger.info(LogCategory.API, 'Security inspection complete', {
      totalFiles: report.totalFiles,
      suspiciousCount: report.suspiciousFiles.length
    });

    res.json({
      summary: {
        totalFiles: report.totalFiles,
        scannedFiles: report.scannedFiles,
        suspiciousCount: report.suspiciousFiles.length,
        structureHash: report.hash
      },
      fileTypes: report.fileTypes,
      suspicious: report.suspiciousFiles,
      samples: {
        largest: enrichedLargeSamples,
        random: enrichedRandomSamples
      }
    });
  } catch (error) {
    logger.error(LogCategory.API, 'Security inspection failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Failed to perform security inspection'
    });
  }
});

export default router;
