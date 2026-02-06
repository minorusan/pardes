import fs from 'fs';
import path from 'path';
import extract from 'extract-zip';
import { logger, LogCategory } from '../logger/logger';

export interface ExtractionProgress {
  archive: string;
  extractedSize: number;
  expectedSize: number;
  percentComplete: number;
  startTime: number;
}

/**
 * Handles extraction of ZIP archives with progress tracking
 * Uses pure Node.js extract-zip (cross-platform, no shell commands)
 */
export class ExtractionService {
  private currentProgress?: ExtractionProgress;
  private progressMonitorInterval?: NodeJS.Timeout;
  private extractionStartTime: number = 0;

  /**
   * Extract a ZIP archive to target directory
   */
  public async extract(
    zipPath: string,
    extractPath: string,
    onProgress?: (progress: ExtractionProgress) => void
  ): Promise<void> {
    const fileName = path.basename(zipPath);
    const zipStats = await fs.promises.stat(zipPath);

    logger.info(LogCategory.SYSTEM, `Extracting: ${fileName}`);

    // Initialize progress with start time
    this.extractionStartTime = Date.now();
    this.currentProgress = {
      archive: fileName,
      extractedSize: 0,
      expectedSize: zipStats.size,
      percentComplete: 0,
      startTime: this.extractionStartTime
    };

    try {
      // Create extraction directory
      await fs.promises.mkdir(extractPath, { recursive: true });

      // Start progress monitoring
      if (onProgress) {
        this.startProgressMonitoring(extractPath, onProgress);
      }

      // Extract using pure Node.js (no Windows/PowerShell bullshit)
      logger.debug(LogCategory.SYSTEM, 'Using extract-zip (cross-platform, fast)');
      await extract(zipPath, { dir: path.resolve(extractPath) });

      // Stop progress monitoring
      this.stopProgressMonitoring();

      // Final progress update
      if (this.currentProgress && onProgress) {
        this.currentProgress.percentComplete = 100;
        onProgress(this.currentProgress);
      }

      // Clear progress line and show completion with total time
      const totalTime = Date.now() - this.extractionStartTime;
      const totalSec = Math.floor(totalTime / 1000);
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      process.stdout.write('\r' + ' '.repeat(120) + '\r');
      console.log(`✅ Extracted: ${fileName} in ${timeStr}`);

      logger.info(LogCategory.SYSTEM, `Successfully extracted: ${fileName} in ${timeStr}`);
    } catch (error) {
      this.stopProgressMonitoring();
      logger.error(LogCategory.SYSTEM, `Extraction failed: ${fileName}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Start monitoring extraction progress
   */
  private startProgressMonitoring(
    extractPath: string,
    callback: (progress: ExtractionProgress) => void
  ): void {
    this.progressMonitorInterval = setInterval(async () => {
      if (!this.currentProgress) return;

      try {
        const size = await this.getDirectorySize(extractPath);
        this.currentProgress.extractedSize = size;
        this.currentProgress.percentComplete = Math.min(
          Math.round((size / this.currentProgress.expectedSize) * 100),
          99
        );

        // CONSOLE OUTPUT - User can see progress in terminal!
        const mb = Math.round(size / 1024 / 1024);
        const totalMb = Math.round(this.currentProgress.expectedSize / 1024 / 1024);
        const percent = this.currentProgress.percentComplete;
        const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));

        // Calculate elapsed time
        const elapsedMs = Date.now() - this.extractionStartTime;
        const elapsedSec = Math.floor(elapsedMs / 1000);
        const minutes = Math.floor(elapsedSec / 60);
        const seconds = elapsedSec % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        process.stdout.write(`\r📦 ${this.currentProgress.archive}: [${bar}] ${percent}% (${mb}MB / ${totalMb}MB) ${timeStr}`);

        callback(this.currentProgress);
      } catch (err) {
        // Ignore errors during monitoring
      }
    }, 2000);
  }

  /**
   * Stop progress monitoring
   */
  private stopProgressMonitoring(): void {
    if (this.progressMonitorInterval) {
      clearInterval(this.progressMonitorInterval);
      this.progressMonitorInterval = undefined;
    }
  }

  /**
   * Get directory size recursively
   */
  private async getDirectorySize(dir: string): Promise<number> {
    let size = 0;

    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          size += await this.getDirectorySize(fullPath);
        } else {
          const stats = await fs.promises.stat(fullPath);
          size += stats.size;
        }
      }
    } catch (err) {
      // Return current size on error
    }

    return size;
  }

  /**
   * Get current progress
   */
  public getCurrentProgress(): ExtractionProgress | undefined {
    return this.currentProgress;
  }
}

export const extractionService = new ExtractionService();
