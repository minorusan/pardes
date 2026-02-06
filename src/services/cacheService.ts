import fs from 'fs';
import path from 'path';
import { logger, LogCategory } from '../logger/logger';
import ManifestService from './manifestService';
import { extractionService, ExtractionProgress } from './extractionService';

export interface ExtractionStats {
  totalFiles: number;
  totalSize: number;
  archives: string[];
  skippedArchives: string[];
  extractionTime: number;
  warnings: string[];
  cacheHit: boolean;
  inProgress: boolean;
  currentArchiveProgress?: ExtractionProgress;
}

/**
 * Manages book cache with smart hash-based extraction
 * Only re-extracts when ZIP files change
 */
class CacheService {
  private cacheDir: string;
  private staticDir: string;
  private manifest: ManifestService;
  private stats: ExtractionStats = {
    totalFiles: 0,
    totalSize: 0,
    archives: [],
    skippedArchives: [],
    extractionTime: 0,
    warnings: [],
    cacheHit: false,
    inProgress: false
  };

  constructor() {
    this.cacheDir = path.join(process.cwd(), '.cache');
    this.staticDir = path.join(process.cwd(), 'static', 'zips');

    // Ensure cache dir exists for manifest
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    this.manifest = new ManifestService(this.cacheDir);
  }

  /**
   * Initialize cache - extract if needed
   */
  public async initialize(): Promise<ExtractionStats> {
    logger.info(LogCategory.SYSTEM, 'Initializing cache with smart extraction...');

    const startTime = Date.now();
    this.stats.inProgress = true;

    try {
      const zipFiles = await this.findZipFiles();

      if (zipFiles.length === 0) {
        logger.warn(LogCategory.SYSTEM, 'No zip files found');
        this.stats.inProgress = false;
        return this.stats;
      }

      // Check which archives need extraction
      const needsExtraction = await this.checkCacheValidity(zipFiles);

      if (needsExtraction.length === 0) {
        // All cached!
        logger.info(LogCategory.SYSTEM, '✓ All archives cached');
        this.stats.cacheHit = true;
        this.stats.skippedArchives = zipFiles;
      } else {
        // Need to extract
        console.log(`\n📦 Extracting ${needsExtraction.length} archive(s)...`);
        logger.info(LogCategory.SYSTEM, `✗ ${needsExtraction.length} archive(s) need extraction`);
        await this.cleanOldCacheData();
        await fs.promises.mkdir(this.cacheDir, { recursive: true });

        for (const zipFile of needsExtraction) {
          await this.extractArchive(zipFile);
        }

        console.log('\n'); // Clear line after extraction
        this.stats.cacheHit = false;
      }

      // Analyze cache
      await this.analyzeCache();

      this.stats.extractionTime = Date.now() - startTime;
      this.stats.inProgress = false;

      logger.info(LogCategory.SYSTEM, 'Cache initialization complete', this.stats);
      return this.stats;
    } catch (error) {
      this.stats.inProgress = false;
      logger.error(LogCategory.SYSTEM, 'Cache initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Check which archives need extraction
   */
  private async checkCacheValidity(zipFiles: string[]): Promise<string[]> {
    const needsExtraction: string[] = [];

    for (const zipFile of zipFiles) {
      const zipPath = path.join(this.staticDir, zipFile);
      const isValid = await this.manifest.isCacheValid(zipFile, zipPath);

      if (isValid) {
        logger.info(LogCategory.SYSTEM, `✓ Cache HIT: ${zipFile}`);
        this.stats.skippedArchives.push(zipFile);
      } else {
        logger.info(LogCategory.SYSTEM, `✗ Cache MISS: ${zipFile}`);
        needsExtraction.push(zipFile);
      }
    }

    return needsExtraction;
  }

  /**
   * Extract a single archive
   */
  private async extractArchive(fileName: string): Promise<void> {
    const zipPath = path.join(this.staticDir, fileName);
    const extractPath = path.join(this.cacheDir, path.parse(fileName).name);

    // Calculate hash
    const fileHash = await this.manifest.calculateFileHash(zipPath);

    // Extract with progress tracking
    await extractionService.extract(zipPath, extractPath, (progress) => {
      this.stats.currentArchiveProgress = progress;
    });

    // Count extracted files
    const stats = await this.getCacheStats(extractPath);

    // Update manifest
    this.manifest.updateArchive(fileName, zipPath, fileHash, stats.fileCount);
    this.stats.archives.push(fileName);

    logger.info(LogCategory.SYSTEM, `Extracted: ${fileName} (${stats.fileCount} files)`);
  }

  /**
   * Analyze cache contents
   */
  private async analyzeCache(): Promise<void> {
    const stats = await this.getCacheStats(this.cacheDir);
    this.stats.totalFiles = stats.fileCount;
    this.stats.totalSize = stats.totalSize;

    logger.info(LogCategory.SYSTEM, 'Cache analysis complete', {
      totalFiles: stats.fileCount,
      totalSizeMB: Math.round(stats.totalSize / 1024 / 1024),
      fileTypes: stats.fileTypes
    });
  }

  /**
   * Get cache statistics
   */
  private async getCacheStats(dir: string): Promise<{
    fileCount: number;
    totalSize: number;
    fileTypes: Record<string, number>;
  }> {
    let fileCount = 0;
    let totalSize = 0;
    const fileTypes: Record<string, number> = {};

    const processDir = async (currentDir: string) => {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await processDir(fullPath);
        } else {
          fileCount++;
          const stats = await fs.promises.stat(fullPath);
          totalSize += stats.size;

          const ext = path.extname(entry.name).toLowerCase();
          fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        }
      }
    };

    await processDir(dir);
    return { fileCount, totalSize, fileTypes };
  }

  /**
   * Find ZIP files in static directory
   */
  private async findZipFiles(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.staticDir);
      return files.filter(f => f.endsWith('.zip'));
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to read static directory');
      return [];
    }
  }

  /**
   * Clean old cache data (preserve manifest)
   */
  private async cleanOldCacheData(): Promise<void> {
    logger.info(LogCategory.SYSTEM, 'Cleaning cache data...');

    try {
      if (!fs.existsSync(this.cacheDir)) return;

      const entries = await fs.promises.readdir(this.cacheDir);

      for (const entry of entries) {
        if (entry === '.manifest.json') continue; // Preserve manifest

        const fullPath = path.join(this.cacheDir, entry);
        await fs.promises.rm(fullPath, { recursive: true, force: true, maxRetries: 3 });
      }

      logger.info(LogCategory.SYSTEM, 'Cache data cleaned');
    } catch (error) {
      logger.warn(LogCategory.SYSTEM, 'Cache cleanup had issues, continuing anyway');
    }
  }

  /**
   * Get current stats
   */
  public getStats(): ExtractionStats {
    return this.stats;
  }

  /**
   * Get cache directory
   */
  public getCacheDir(): string {
    return this.cacheDir;
  }
}

export const cacheService = new CacheService();
