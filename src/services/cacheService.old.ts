import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { logger, LogCategory } from '../logger/logger';
import ManifestService from './manifestService';

const execAsync = promisify(exec);

export interface ExtractionStats {
  totalFiles: number;
  totalSize: number; // bytes
  archives: string[];
  skippedArchives: string[];
  extractionTime: number; // ms
  warnings: string[];
  cacheHit: boolean;
  inProgress: boolean;
  currentArchive?: string;
  currentArchiveProgress?: {
    name: string;
    extractedSize: number; // bytes
    expectedSize: number; // bytes
    percentComplete: number;
  };
}

class CacheService {
  private cacheDir: string;
  private staticDir: string;
  private manifest: ManifestService;
  private extractionStats: ExtractionStats = {
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
   * Initialize cache directory and extract archives (smart caching)
   */
  public async initialize(): Promise<ExtractionStats> {
    logger.info(LogCategory.SYSTEM, 'Initializing cache service with smart caching...');

    const startTime = Date.now();

    try {
      // Find all zip files
      const zipFiles = await this.findZipFiles();
      logger.info(LogCategory.SYSTEM, `Found ${zipFiles.length} archive(s) to check`);

      if (zipFiles.length === 0) {
        logger.warn(LogCategory.SYSTEM, 'No zip files found in static/zips directory');
        return this.extractionStats;
      }

      let needsExtraction = false;

      // Check each archive's hash
      for (const zipFile of zipFiles) {
        const zipPath = path.join(this.staticDir, zipFile);
        const cacheValid = await this.manifest.isCacheValid(zipFile, zipPath);

        if (cacheValid) {
          logger.info(LogCategory.SYSTEM, `✓ Cache HIT for ${zipFile} - skipping extraction`);
          this.extractionStats.skippedArchives.push(zipFile);
        } else {
          logger.info(LogCategory.SYSTEM, `✗ Cache MISS for ${zipFile} - needs extraction`);
          needsExtraction = true;
        }
      }

      if (needsExtraction) {
        // Clean old cache and re-extract
        logger.info(LogCategory.SYSTEM, 'Cache invalid - cleaning and re-extracting...');
        await this.cleanCacheData();

        // Create fresh cache directory
        await fs.promises.mkdir(this.cacheDir, { recursive: true });
        logger.info(LogCategory.SYSTEM, `Cache directory created: ${this.cacheDir}`);

        // Extract each archive that needs it
        for (const zipFile of zipFiles) {
          const zipPath = path.join(this.staticDir, zipFile);
          const cacheValid = await this.manifest.isCacheValid(zipFile, zipPath);

          if (!cacheValid) {
            await this.extractArchive(zipFile);
          }
        }

        // Analyze extracted content
        await this.analyzeCache();

        this.extractionStats.cacheHit = false;
      } else {
        // All archives cached - just analyze existing cache
        logger.info(LogCategory.SYSTEM, '✓ All archives cached - using existing extraction');
        await this.analyzeCache();
        this.extractionStats.cacheHit = true;
      }

      this.extractionStats.extractionTime = Date.now() - startTime;
      this.extractionStats.inProgress = false;
      logger.info(LogCategory.SYSTEM, 'Cache initialization complete', this.extractionStats);

      // Manifest is automatically created during extraction in extractArchive()
      // No manual populate-manifest needed!

      return this.extractionStats;
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Cache initialization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Find all zip files in static directory
   */
  private async findZipFiles(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.staticDir);
      const zipFiles = files.filter(f => f.endsWith('.zip'));

      logger.debug(LogCategory.SYSTEM, `Zip files found: ${zipFiles.join(', ')}`);
      return zipFiles;
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to read static directory', {
        path: this.staticDir,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  /**
   * Extract a single archive with security checks and progress tracking
   */
  private async extractArchive(fileName: string): Promise<void> {
    const zipPath = path.join(this.staticDir, fileName);
    const extractPath = path.join(this.cacheDir, path.parse(fileName).name);

    logger.info(LogCategory.SYSTEM, `Extracting archive: ${fileName}`);

    try {
      // Get archive size for progress tracking
      const zipStats = await fs.promises.stat(zipPath);
      const expectedSize = zipStats.size;

      // Set extraction in progress
      this.extractionStats.inProgress = true;
      this.extractionStats.currentArchive = fileName;
      this.extractionStats.currentArchiveProgress = {
        name: fileName,
        extractedSize: 0,
        expectedSize,
        percentComplete: 0
      };

      // Calculate hash before extraction
      logger.debug(LogCategory.SYSTEM, `Calculating hash for ${fileName}...`);
      const fileHash = await this.manifest.calculateFileHash(zipPath);
      logger.debug(LogCategory.SYSTEM, `Hash: ${fileHash.substring(0, 16)}...`);

      // Create extraction subdirectory
      await fs.promises.mkdir(extractPath, { recursive: true });

      // Get archive info first (without extracting)
      const listCommand = process.platform === 'win32'
        ? `powershell -command "Add-Type -A 'System.IO.Compression.FileSystem'; [IO.Compression.ZipFile]::OpenRead('${zipPath}').Entries | Select-Object -First 10 | Format-Table Name, Length"`
        : `unzip -l "${zipPath}" | head -20`;

      logger.debug(LogCategory.SYSTEM, `Listing archive contents: ${fileName}`);
      const { stdout: listOutput } = await execAsync(listCommand);
      logger.debug(LogCategory.SYSTEM, `Archive preview:\n${listOutput}`);

      // SECURITY: Check for suspicious patterns in file listing
      const suspiciousPatterns = [
        /\.\.(\/|\\)/, // Path traversal
        /\.exe$/i,     // Windows executables
        /\.bat$/i,     // Batch files
        /\.cmd$/i,     // Command files
        /\.sh$/i,      // Shell scripts
        /\.ps1$/i,     // PowerShell scripts
        /\.vbs$/i,     // VBScript
        /\.js$/i,      // JavaScript (unexpected in book archive)
        /\.dll$/i,     // DLLs
        /\.so$/i,      // Shared objects
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(listOutput)) {
          const warning = `SECURITY WARNING: Suspicious file pattern detected in ${fileName}: ${pattern}`;
          logger.warn(LogCategory.SYSTEM, warning);
          this.extractionStats.warnings.push(warning);
        }
      }

      // Start progress monitoring in background
      const progressMonitor = setInterval(async () => {
        try {
          if (fs.existsSync(extractPath)) {
            const stats = await this.getDirectorySize(extractPath);
            const percentComplete = Math.min(Math.round((stats / expectedSize) * 100), 99);

            if (this.extractionStats.currentArchiveProgress) {
              this.extractionStats.currentArchiveProgress.extractedSize = stats;
              this.extractionStats.currentArchiveProgress.percentComplete = percentComplete;
            }

            logger.debug(LogCategory.SYSTEM, `Extraction progress: ${percentComplete}% (${Math.round(stats / 1024 / 1024)}MB)`);
          }
        } catch (err) {
          // Ignore errors during progress monitoring
        }
      }, 2000); // Update every 2 seconds

      // Extract the archive - prefer unzip over PowerShell (much faster!)
      let extractCommand: string;

      // Check if unzip is available (Git Bash on Windows)
      try {
        await execAsync('unzip -v');
        extractCommand = `unzip -q "${zipPath}" -d "${extractPath}"`;
        logger.debug(LogCategory.SYSTEM, 'Using unzip (fast extraction)');
      } catch {
        // Fallback to PowerShell on Windows, native unzip on Unix
        extractCommand = process.platform === 'win32'
          ? `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractPath}' -Force"`
          : `unzip -q "${zipPath}" -d "${extractPath}"`;
        logger.debug(LogCategory.SYSTEM, 'Using PowerShell (slow extraction)');
      }

      logger.info(LogCategory.SYSTEM, `Extracting to: ${extractPath}`);
      await execAsync(extractCommand, { maxBuffer: 1024 * 1024 * 100 }); // 100MB buffer

      // Stop progress monitoring
      clearInterval(progressMonitor);

      // Count extracted files
      const stats = await this.getCacheStats(extractPath);

      // Update progress to 100%
      if (this.extractionStats.currentArchiveProgress) {
        this.extractionStats.currentArchiveProgress.percentComplete = 100;
        this.extractionStats.currentArchiveProgress.extractedSize = stats.totalSize;
      }

      // Update manifest with successful extraction
      this.manifest.updateArchive(fileName, zipPath, fileHash, stats.fileCount);

      this.extractionStats.archives.push(fileName);
      logger.info(LogCategory.SYSTEM, `Successfully extracted: ${fileName} (${stats.fileCount} files)`);

      // Clear current archive progress
      this.extractionStats.currentArchive = undefined;
      this.extractionStats.currentArchiveProgress = undefined;
    } catch (error) {
      logger.error(LogCategory.SYSTEM, `Failed to extract archive: ${fileName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Clear progress on error
      this.extractionStats.inProgress = false;
      this.extractionStats.currentArchive = undefined;
      this.extractionStats.currentArchiveProgress = undefined;

      throw error;
    }
  }

  /**
   * Get directory size quickly (for progress monitoring)
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
   * Analyze extracted cache for security and stats
   */
  private async analyzeCache(): Promise<void> {
    logger.info(LogCategory.SYSTEM, 'Analyzing extracted cache...');

    try {
      const stats = await this.getCacheStats(this.cacheDir);
      this.extractionStats.totalFiles = stats.fileCount;
      this.extractionStats.totalSize = stats.totalSize;

      logger.info(LogCategory.SYSTEM, 'Cache analysis complete', {
        totalFiles: stats.fileCount,
        totalSizeMB: Math.round(stats.totalSize / 1024 / 1024),
        fileTypes: stats.fileTypes
      });

      // SECURITY: Log any unexpected file types
      const expectedExtensions = ['.fb2', '.epub', '.txt', '.mobi', '.xml', '.html'];
      const unexpectedTypes = Object.keys(stats.fileTypes).filter(
        ext => !expectedExtensions.includes(ext.toLowerCase())
      );

      if (unexpectedTypes.length > 0) {
        const warning = `Unexpected file types found: ${unexpectedTypes.join(', ')}`;
        logger.warn(LogCategory.SYSTEM, warning, stats.fileTypes);
        this.extractionStats.warnings.push(warning);
      }
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Cache analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Recursively get cache statistics
   */
  private async getCacheStats(dir: string): Promise<{
    fileCount: number;
    totalSize: number;
    fileTypes: Record<string, number>;
  }> {
    let fileCount = 0;
    let totalSize = 0;
    const fileTypes: Record<string, number> = {};

    const processDirectory = async (currentDir: string) => {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else {
          fileCount++;
          const stats = await fs.promises.stat(fullPath);
          totalSize += stats.size;

          const ext = path.extname(entry.name).toLowerCase();
          fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        }
      }
    };

    await processDirectory(dir);
    return { fileCount, totalSize, fileTypes };
  }

  /**
   * Clean up cache data (but preserve manifest)
   * Uses aggressive deletion for Windows stubborn directories
   */
  private async cleanCacheData(): Promise<void> {
    logger.info(LogCategory.SYSTEM, 'Cleaning cache data...');

    try {
      if (!fs.existsSync(this.cacheDir)) {
        logger.debug(LogCategory.SYSTEM, 'Cache directory does not exist, skipping cleanup');
        return;
      }

      const entries = await fs.promises.readdir(this.cacheDir);

      for (const entry of entries) {
        // Skip .manifest.json
        if (entry === '.manifest.json') continue;

        const fullPath = path.join(this.cacheDir, entry);

        try {
          // Try standard deletion first
          await fs.promises.rm(fullPath, { recursive: true, force: true, maxRetries: 3 });
          logger.debug(LogCategory.SYSTEM, `Deleted: ${entry}`);
        } catch (error) {
          // If standard deletion fails, use platform-specific aggressive deletion
          logger.warn(LogCategory.SYSTEM, `Standard deletion failed for ${entry}, trying aggressive method...`);

          try {
            if (process.platform === 'win32') {
              // Use PowerShell Remove-Item with force on Windows
              const { exec } = require('child_process');
              const { promisify } = require('util');
              const execAsync = promisify(exec);

              await execAsync(`powershell -command "Remove-Item -Path '${fullPath}' -Recurse -Force -ErrorAction SilentlyContinue"`);
              logger.debug(LogCategory.SYSTEM, `Force deleted: ${entry}`);
            } else {
              // Use rm -rf on Unix
              await execAsync(`rm -rf "${fullPath}"`);
            }
          } catch (aggressiveError) {
            // If even aggressive deletion fails, just log and continue
            logger.warn(LogCategory.SYSTEM, `Could not delete ${entry}, will be overwritten on extraction`, {
              error: aggressiveError instanceof Error ? aggressiveError.message : 'Unknown error'
            });
          }
        }
      }

      logger.info(LogCategory.SYSTEM, 'Cache data cleaned (manifest preserved)');
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to clean cache', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw - allow extraction to continue and overwrite
      logger.info(LogCategory.SYSTEM, 'Continuing with extraction despite cleanup errors');
    }
  }

  /**
   * Clean up entire cache directory (including manifest)
   */
  public async cleanCache(): Promise<void> {
    logger.info(LogCategory.SYSTEM, 'Cleaning entire cache directory...');

    try {
      if (fs.existsSync(this.cacheDir)) {
        await fs.promises.rm(this.cacheDir, { recursive: true, force: true });
        logger.info(LogCategory.SYSTEM, 'Cache cleaned successfully');
      } else {
        logger.debug(LogCategory.SYSTEM, 'Cache directory does not exist, skipping cleanup');
      }
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to clean cache', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get current extraction stats
   */
  public getStats(): ExtractionStats {
    return this.extractionStats;
  }

  /**
   * Get cache directory path
   */
  public getCacheDir(): string {
    return this.cacheDir;
  }
}

export const cacheService = new CacheService();
